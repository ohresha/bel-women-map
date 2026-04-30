import { EnvironmentInjector, inject, Injectable, runInInjectionContext } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import {
  Database,
  get,
  objectVal,
  ref,
  remove,
  set,
} from '@angular/fire/database';
import { catchError, defer, map, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { BiographyBlock, WomanDetails, WomanProfile, WomanRecord } from '../models/woman-record.model';

interface DataStructure {
  profiles: WomanProfile[];
  details: WomanDetails[];
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private readonly injector = inject(EnvironmentInjector);
  private readonly auth = inject(Auth);
  private readonly database = inject(Database);
  private readonly allowedAdminEmails = environment.adminEmails.map((email) => email.toLowerCase());

  readonly user$: Observable<User | null> = defer(() =>
    runInInjectionContext(this.injector, () => authState(this.auth))
  );
  readonly isAuthenticated$: Observable<boolean> = this.user$.pipe(map((user) => !!user));

  async login(email: string, password: string): Promise<User> {
    const credentials = await runInInjectionContext(this.injector, () =>
      signInWithEmailAndPassword(this.auth, email, password)
    );
    const userEmail = credentials.user.email?.toLowerCase() ?? '';

    if (this.allowedAdminEmails.length > 0 && !this.allowedAdminEmails.includes(userEmail)) {
      await runInInjectionContext(this.injector, () => signOut(this.auth));
      throw new Error('У этой учетной записи нет прав администратора.');
    }

    return credentials.user;
  }

  logout(): Promise<void> {
    return runInInjectionContext(this.injector, () => signOut(this.auth));
  }

  observeWomen(): Observable<WomanRecord[]> {
    return defer(() =>
      runInInjectionContext(this.injector, () => objectVal(ref(this.database)))
    ).pipe(
      map((data) => this.normalizeDataStructure(data)),
      map((data) => this.mergeData(data)),
      map((items) => items.sort((a, b) => a.name.localeCompare(b.name, 'ru'))),
      map((items) => items.map((item) => this.cloneRecord(item))),
      catchError((error) => {
        console.error('Ошибка при чтении данных из Firebase:', error);
        return throwError(() => error);
      })
    );
  }

  async saveWoman(record: WomanRecord): Promise<void> {
    try {
      const normalizedRecord = this.normalizeWomanRecord(record);
      const safeId = this.assertValidRecordId(normalizedRecord.id);

      const profile: WomanProfile = {
        id: normalizedRecord.id,
        name: normalizedRecord.name,
        birth: normalizedRecord.birth,
        death: normalizedRecord.death,
        region: normalizedRecord.region,
        city: normalizedRecord.city,
        categories: normalizedRecord.categories,
        century: normalizedRecord.century,
        shortInfo: normalizedRecord.shortInfo,
        coordinates: normalizedRecord.coordinates,
        images: normalizedRecord.images
      };

      const details: WomanDetails = {
        id: normalizedRecord.id,
        heroImage: normalizedRecord.heroImage,
        previewImages: normalizedRecord.previewImages,
        fullBiography: normalizedRecord.fullBiography
      };

      await runInInjectionContext(this.injector, async () => {
        await Promise.all([
          set(ref(this.database, `profiles/${safeId}`), this.toPlainData(profile)),
          set(ref(this.database, `details/${safeId}`), this.toPlainData(details))
        ]);
      });
    } catch (error) {
      console.error('Ошибка при сохранении записи в Firebase:', error);
      throw error;
    }
  }

  async deleteWoman(id: string): Promise<void> {
    try {
      const safeId = this.assertValidRecordId(id);
      await runInInjectionContext(this.injector, async () => {
        await Promise.all([
          remove(ref(this.database, `profiles/${safeId}`)),
          remove(ref(this.database, `details/${safeId}`))
        ]);
      });
    } catch (error) {
      console.error(`Ошибка при удалении записи "${id}" из Firebase:`, error);
      throw error;
    }
  }

  async hasWomen(): Promise<boolean> {
    try {
      const snapshot = await runInInjectionContext(this.injector, () => get(ref(this.database, 'profiles')));
      const value = snapshot.val();
      return snapshot.exists() && (
        Array.isArray(value)
          ? value.length > 0
          : !!value && typeof value === 'object' && Object.keys(value).length > 0
      );
    } catch (error) {
      console.error('Ошибка при проверке наличия записей в Firebase:', error);
      throw error;
    }
  }

  async seedWomen(records: WomanRecord[]): Promise<void> {
    try {
      const sanitizedRecords = records.map((record) => this.normalizeWomanRecord(record));
      await runInInjectionContext(this.injector, () =>
        set(ref(this.database), this.toPlainData(this.splitRecords(sanitizedRecords)))
      );
    } catch (error) {
      console.error('Ошибка при первичной загрузке записей в Firebase:', error);
      throw error;
    }
  }

  private normalizeDataStructure(data: unknown): DataStructure {
    const value = (data ?? {}) as Partial<DataStructure>;
    return {
      profiles: this.normalizeCollection<WomanProfile>(value.profiles),
      details: this.normalizeCollection<WomanDetails>(value.details)
    };
  }

  private mergeData(data: DataStructure): WomanRecord[] {
    return data.profiles.map((profile) => {
      const details = data.details.find((item) => item.id === profile.id);
      return this.cloneRecord({
        ...profile,
        heroImage: details?.heroImage || profile.images?.[0] || 'assets/stockWoman.webp',
        previewImages: details?.previewImages || profile.images || [],
        fullBiography: details?.fullBiography || []
      });
    });
  }

  private splitRecords(records: WomanRecord[]): DataStructure {
    return {
      profiles: records.map((record) => ({
        id: this.assertValidRecordId(record.id),
        name: record.name,
        birth: record.birth,
        death: record.death,
        region: record.region,
        city: record.city,
        categories: [...record.categories],
        century: record.century,
        shortInfo: record.shortInfo,
        coordinates: [...record.coordinates] as [number, number],
        images: [...record.images]
      })),
      details: records.map((record) => ({
        id: this.assertValidRecordId(record.id),
        heroImage: record.heroImage,
        previewImages: [...record.previewImages],
        fullBiography: record.fullBiography.map((block) => this.cloneBiographyBlock(block))
      }))
    };
  }

  private normalizeCollection<T>(value: unknown): T[] {
    if (Array.isArray(value)) {
      return value.filter(Boolean) as T[];
    }

    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, T>).filter(Boolean);
    }

    return [];
  }

  private normalizeWomanRecord(record: WomanRecord): WomanRecord {
    const normalizedRecord: WomanRecord = {
      ...record,
      id: this.assertValidRecordId(record.id),
      name: record.name.trim(),
      birth: typeof record.birth === 'number' ? record.birth : undefined,
      death: typeof record.death === 'number' ? record.death : undefined,
      region: record.region.trim(),
      city: record.city.trim(),
      century: record.century.trim(),
      shortInfo: record.shortInfo.trim(),
      coordinates: this.normalizeCoordinates(record.coordinates),
      categories: record.categories.map((item) => item.trim()).filter(Boolean),
      images: record.images.map((item) => item.trim()).filter(Boolean),
      previewImages: record.previewImages.map((item) => item.trim()).filter(Boolean),
      heroImage: record.heroImage.trim(),
      fullBiography: record.fullBiography.map((block) => this.normalizeBiographyBlock(block))
    };

    return this.toPlainData(normalizedRecord);
  }

  private normalizeBiographyBlock(block: BiographyBlock): BiographyBlock {
    if (block.type === 'text') {
      return {
        type: 'text',
        title: block.title.trim(),
        text: block.text.trim(),
        image: block.image?.trim() || '',
        imageSide: block.imageSide === 'left' || block.imageSide === 'right' ? block.imageSide : 'right'
      };
    }

    if (block.type === 'quote') {
      return {
        type: 'quote',
        text: block.text.trim(),
        author: block.author?.trim() || ''
      };
    }

    return {
      type: 'image-gallery',
      title: block.title?.trim() || '',
      images: block.images
        .map((image) => ({
          src: image.src.trim(),
          caption: image.caption?.trim() || ''
        }))
        .filter((image) => !!image.src)
    };
  }

  private normalizeCoordinates(coordinates: WomanRecord['coordinates']): [number, number] {
    const latitude = Number(coordinates?.[0]);
    const longitude = Number(coordinates?.[1]);

    return [
      Number.isFinite(latitude) ? latitude : 53.9,
      Number.isFinite(longitude) ? longitude : 27.5667
    ];
  }

  private assertValidRecordId(id: unknown): string {
    if (typeof id !== 'string') {
      throw new Error('Не удалось выполнить операцию: ID записи должен быть строкой.');
    }

    const normalizedId = id.trim();
    if (!normalizedId) {
      throw new Error('Не удалось выполнить операцию: ID записи не должен быть пустым.');
    }

    if (/[.#$/\[\]]/.test(normalizedId)) {
      throw new Error('Не удалось выполнить операцию: ID записи содержит недопустимые символы для Firebase.');
    }

    return normalizedId;
  }

  private toPlainData<T>(data: T): T {
    return JSON.parse(JSON.stringify(data)) as T;
  }

  private cloneRecord(record: WomanRecord): WomanRecord {
    return {
      ...record,
      coordinates: [...record.coordinates] as [number, number],
      categories: [...record.categories],
      images: [...record.images],
      previewImages: [...record.previewImages],
      fullBiography: record.fullBiography.map((block) => this.cloneBiographyBlock(block))
    };
  }

  private cloneBiographyBlock(block: BiographyBlock): BiographyBlock {
    if (block.type === 'image-gallery') {
      return {
        ...block,
        images: block.images.map((image) => ({ ...image }))
      };
    }

    return { ...block };
  }
}
