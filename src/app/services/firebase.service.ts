import { EnvironmentInjector, inject, Injectable, runInInjectionContext } from '@angular/core';
import { Auth, authState, signInWithEmailAndPassword, signOut, User } from '@angular/fire/auth';
import {
  Database,
  get,
  ref,
  remove,
  set
} from '@angular/fire/database';
import { defer, map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { BiographyBlock, WomanDetails, WomanProfile, WomanRecord } from '../models/woman-record.model';

interface WomenDataSnapshot {
  profiles?: unknown;
  details?: unknown;
}

export interface WomenDataPayload {
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
  readonly isAdmin$: Observable<boolean> = this.user$.pipe(map((user) => this.isAdminUser(user)));

  async login(email: string, password: string): Promise<User> {
    const credentials = await runInInjectionContext(this.injector, () =>
      signInWithEmailAndPassword(this.auth, email, password)
    );
    const userEmail = credentials.user.email?.toLowerCase() ?? '';

    if (!this.isAdminEmail(userEmail)) {
      await runInInjectionContext(this.injector, () => signOut(this.auth));
      throw new Error('У этой учетной записи нет прав администратора.');
    }

    return credentials.user;
  }

  logout(): Promise<void> {
    return runInInjectionContext(this.injector, () => signOut(this.auth));
  }

  isAdminUser(user: User | null): boolean {
    const userEmail = user?.email?.toLowerCase() ?? '';
    return this.isAdminEmail(userEmail);
  }

  async getWomenData(): Promise<WomenDataPayload> {
    const snapshot = await runInInjectionContext(this.injector, () => get(ref(this.database, '/')));
    const data = (snapshot.val() ?? {}) as WomenDataSnapshot;

    return {
      profiles: this.normalizeArray<WomanProfile>(data.profiles),
      details: this.normalizeArray<WomanDetails>(data.details)
    };
  }

  async saveWomanRecord(record: WomanRecord, originalId?: string | null): Promise<void> {
    const profile = this.toProfile(record);
    const details = this.toDetails(record);
    const normalizedOriginalId = originalId?.trim() || null;
    const targetProfileRef = ref(this.database, `/profiles/${record.id}`);
    const targetDetailsRef = ref(this.database, `/details/${record.id}`);

    await Promise.all([
      runInInjectionContext(this.injector, () => set(targetProfileRef, profile)),
      runInInjectionContext(this.injector, () => set(targetDetailsRef, details))
    ]);

    if (normalizedOriginalId && normalizedOriginalId !== record.id) {
      await Promise.all([
        runInInjectionContext(this.injector, () => remove(ref(this.database, `/profiles/${normalizedOriginalId}`))),
        runInInjectionContext(this.injector, () => remove(ref(this.database, `/details/${normalizedOriginalId}`)))
      ]);
    }
  }

  private normalizeArray<T>(value: unknown): T[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is T => !!item && typeof item === 'object');
    }

    if (value && typeof value === 'object') {
      return Object.values(value as Record<string, T>).filter(
        (item): item is T => !!item && typeof item === 'object'
      );
    }

    return [];
  }

  private toProfile(record: WomanRecord): WomanProfile {
    return {
      id: record.id,
      name: record.name,
      birth: record.birth,
      death: record.death,
      region: record.region,
      city: record.city,
      categories: record.categories,
      century: record.century,
      shortInfo: record.shortInfo,
      coordinates: record.coordinates,
      images: record.images
    };
  }

  private toDetails(record: WomanRecord): WomanDetails {
    return {
      id: record.id,
      heroImage: record.heroImage,
      previewImages: record.previewImages,
      fullBiography: record.fullBiography.map((block) => this.normalizeBiographyBlock(block))
    };
  }

  private normalizeBiographyBlock(block: BiographyBlock): BiographyBlock {
    if (block.type === 'quote') {
      const normalizedQuote: BiographyBlock = {
        type: 'quote',
        text: block.text.trim()
      };

      if (block.author?.trim()) {
        normalizedQuote.author = block.author.trim();
      }

      return normalizedQuote;
    }

    if (block.type === 'image-gallery') {
      const normalizedGallery: BiographyBlock = {
        type: 'image-gallery',
        images: (block.images ?? []).filter((image) => image?.src?.trim()).map((image) => ({
          src: image.src.trim(),
          caption: image.caption?.trim() ?? ''
        }))
      };

      if (block.title?.trim()) {
        normalizedGallery.title = block.title.trim();
      }

      return normalizedGallery;
    }

    const normalizedText: BiographyBlock = {
      type: 'text',
      title: block.title.trim(),
      text: block.text.trim(),
      image: block.image?.trim() ?? ''
    };

    if (block.imageSide === 'left' || block.imageSide === 'right') {
      normalizedText.imageSide = block.imageSide;
    }

    return normalizedText;
  }

  private isAdminEmail(email: string): boolean {
    return this.allowedAdminEmails.length === 0 || this.allowedAdminEmails.includes(email);
  }

}
