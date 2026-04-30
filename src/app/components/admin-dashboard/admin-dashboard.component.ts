import { AsyncPipe, NgIf } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FirebaseService } from '../../services/firebase.service';
import { MapDataService } from '../../services/map-data.service';
import { BiographyBlock, WomanRecord } from '../../models/woman-record.model';

type BiographyType = BiographyBlock['type'];

@Component({
  selector: 'app-admin-dashboard',
  imports: [NgIf, AsyncPipe, RouterLink, ReactiveFormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly firebaseService = inject(FirebaseService);
  private readonly mapDataService = inject(MapDataService);
  private readonly router = inject(Router);

  protected readonly user$ = this.firebaseService.user$;
  protected readonly records = signal<WomanRecord[]>([]);
  protected readonly selectedId = signal<string | null>(null);
  protected readonly feedbackMessage = signal('');
  protected readonly feedbackType = signal<'success' | 'error'>('success');
  protected readonly isSaving = signal(false);
  protected readonly isSeeding = signal(false);

  protected readonly summary = computed(() => {
    const items = this.records();
    return {
      total: items.length,
      regions: new Set(items.map((item) => item.region)).size,
      categories: new Set(items.flatMap((item) => item.categories)).size
    };
  });

  protected readonly form = this.fb.nonNullable.group({
    id: ['', [Validators.required]],
    name: ['', [Validators.required]],
    birth: [null as number | null],
    death: [null as number | null],
    region: ['', [Validators.required]],
    city: ['', [Validators.required]],
    century: ['', [Validators.required]],
    shortInfo: ['', [Validators.required, Validators.minLength(20)]],
    latitude: [53.9, [Validators.required]],
    longitude: [27.5667, [Validators.required]],
    categories: this.fb.array([]),
    images: this.fb.array([]),
    heroImage: ['', [Validators.required]],
    previewImages: this.fb.array([]),
    fullBiography: this.fb.array([])
  });

  constructor() {
    this.firebaseService.observeWomen()
      .pipe(takeUntilDestroyed())
      .subscribe((records) => {
        this.records.set(records);

        const selectedId = this.selectedId();
        if (!selectedId) {
          if (records[0]) {
            this.editRecord(records[0]);
          } else {
            this.createNewRecord();
          }
          return;
        }

        const nextRecord = records.find((record) => record.id === selectedId);
        if (nextRecord) {
          this.patchRecord(nextRecord);
        }
      }, (error) => {
        console.error('Ошибка при загрузке записей для админ-панели:', error);
        this.setFeedback(this.readError(error), 'error');
      });
  }

  protected get categoriesArray(): FormArray {
    return this.form.controls.categories;
  }

  protected get imagesArray(): FormArray {
    return this.form.controls.images;
  }

  protected get previewImagesArray(): FormArray {
    return this.form.controls.previewImages;
  }

  protected get biographyArray(): FormArray {
    return this.form.controls.fullBiography;
  }

  protected editRecord(record: WomanRecord): void {
    this.selectedId.set(record.id);
    this.patchRecord(record);
  }

  protected createNewRecord(): void {
    this.selectedId.set(null);
    this.resetFormState({
      id: '',
      name: '',
      birth: undefined,
      death: undefined,
      region: '',
      city: '',
      century: '',
      shortInfo: '',
      coordinates: [53.9, 27.5667],
      categories: [''],
      images: ['assets/stockWoman.webp'],
      heroImage: 'assets/stockWoman.webp',
      previewImages: ['assets/stockWoman.webp'],
      fullBiography: []
    });
    this.feedbackMessage.set('');
  }

  protected async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.setFeedback('Проверьте форму перед сохранением.', 'error');
      return;
    }

    this.isSaving.set(true);
    this.feedbackMessage.set('');

    try {
      const record = this.buildRecordFromForm();
      await this.firebaseService.saveWoman(record);
      this.selectedId.set(record.id);
      this.setFeedback('Запись успешно сохранена.', 'success');
    } catch (error) {
      console.error('Ошибка при сохранении записи:', error);
      this.setFeedback(this.readError(error), 'error');
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async deleteCurrent(): Promise<void> {
    const id = this.form.controls.id.value?.trim();
    if (!id) {
      this.setFeedback('Сначала выберите запись для удаления.', 'error');
      return;
    }

    const confirmed = window.confirm(`Удалить запись «${this.form.controls.name.value || id}»?`);
    if (!confirmed) {
      return;
    }

    try {
      await this.firebaseService.deleteWoman(id);
      this.setFeedback('Запись удалена.', 'success');
      const remaining = this.records().filter((record) => record.id !== id);
      if (remaining[0]) {
        this.editRecord(remaining[0]);
      } else {
        this.createNewRecord();
      }
    } catch (error) {
      console.error(`Ошибка при удалении записи с ID "${id}":`, error);
      this.setFeedback(this.readError(error), 'error');
    }
  }

  protected async seedFromJson(): Promise<void> {
    this.isSeeding.set(true);
    this.feedbackMessage.set('');

    try {
      const records = await firstValueFrom(this.mapDataService.getLocalWomenRecords());
      await this.firebaseService.seedWomen(records);
      this.setFeedback('Исходные записи загружены из локального JSON.', 'success');
    } catch (error) {
      console.error('Ошибка при загрузке исходных записей:', error);
      this.setFeedback(this.readError(error), 'error');
    } finally {
      this.isSeeding.set(false);
    }
  }

  protected async logout(): Promise<void> {
    try {
      await this.firebaseService.logout();
      await this.router.navigate(['/']);
    } catch (error) {
      console.error('Ошибка при выходе из админ-панели:', error);
      this.setFeedback(this.readError(error), 'error');
    }
  }

  protected addCategory(value = ''): void {
    this.categoriesArray.push(this.fb.nonNullable.control(value, Validators.required));
  }

  protected removeCategory(index: number): void {
    if (this.categoriesArray.length > 1) {
      this.categoriesArray.removeAt(index);
    }
  }

  protected addImage(value = ''): void {
    this.imagesArray.push(this.fb.nonNullable.control(value, Validators.required));
  }

  protected removeImage(index: number): void {
    if (this.imagesArray.length > 1) {
      this.imagesArray.removeAt(index);
    }
  }

  protected addPreviewImage(value = ''): void {
    this.previewImagesArray.push(this.fb.nonNullable.control(value, Validators.required));
  }

  protected removePreviewImage(index: number): void {
    if (this.previewImagesArray.length > 1) {
      this.previewImagesArray.removeAt(index);
    }
  }

  protected addBiographyBlock(type: BiographyType): void {
    this.biographyArray.push(this.createBiographyGroup(type));
  }

  protected removeBiographyBlock(index: number): void {
    if (this.biographyArray.length > 1) {
      this.biographyArray.removeAt(index);
    }
  }

  protected addGalleryImage(blockIndex: number): void {
    this.getGalleryImagesArray(blockIndex).push(this.createGalleryImageGroup());
  }

  protected removeGalleryImage(blockIndex: number, imageIndex: number): void {
    const images = this.getGalleryImagesArray(blockIndex);
    if (images.length > 1) {
      images.removeAt(imageIndex);
    }
  }

  protected biographyTypeAt(index: number): BiographyType {
    return this.biographyArray.at(index).get('type')?.value as BiographyType;
  }

  protected galleryImagesControls(blockIndex: number) {
    return this.getGalleryImagesArray(blockIndex).controls;
  }

  private patchRecord(record: WomanRecord): void {
    const recordCopy = this.cloneRecord(record);
    this.resetFormState(recordCopy);
  }

 private buildRecordFromForm(): WomanRecord {
  const rawValue = this.form.getRawValue();
  
  const fullBiography = this.biographyArray.controls
    .map((blockControl): BiographyBlock | undefined => {
      const block = blockControl.getRawValue();
      if (block.type === 'text') {
        return {
          type: 'text',
          title: (block.title ?? '').trim(),
          text: (block.text ?? '').trim(),
          image: (block.image ?? '').trim(),
          imageSide: block.imageSide === 'left' ? 'left' : 'right'
        };
      }
      return undefined;
    })
    .filter((block): block is BiographyBlock => block !== undefined);

  return {
    id: rawValue.id.trim(),
    name: rawValue.name.trim(),
    birth: rawValue.birth ?? undefined,
    death: rawValue.death ?? undefined,
    region: rawValue.region.trim(),
    city: rawValue.city.trim(),
    century: rawValue.century.trim(),
    shortInfo: rawValue.shortInfo.trim(),
    coordinates: [Number(rawValue.latitude), Number(rawValue.longitude)],
    categories: (rawValue.categories as string[]).map((s) => s.trim()).filter(Boolean),
    images: (rawValue.images as string[]).map((s) => s.trim()).filter(Boolean),
    heroImage: rawValue.heroImage.trim(),
    previewImages: (rawValue.previewImages as string[]).map((s) => s.trim()).filter(Boolean),
    fullBiography
  };
}

  private createBiographyGroup(type: BiographyType, block?: BiographyBlock) {
    if (type === 'text') {
      const textBlock = block?.type === 'text' ? block : undefined;
      return this.fb.nonNullable.group({
        type: this.fb.nonNullable.control<'text'>('text'),
        title: [textBlock?.title || '', Validators.required],
        text: [textBlock?.text || '', Validators.required],
        image: [textBlock?.image || ''],
        imageSide: [textBlock?.imageSide || 'right']
      });
    }

    if (type === 'quote') {
      const quoteBlock = block?.type === 'quote' ? block : undefined;
      return this.fb.nonNullable.group({
        type: this.fb.nonNullable.control<'quote'>('quote'),
        text: [quoteBlock?.text || '', Validators.required],
        author: [quoteBlock?.author || '']
      });
    }

    const galleryBlock = block?.type === 'image-gallery' ? block : undefined;
    return this.fb.nonNullable.group({
      type: this.fb.nonNullable.control<'image-gallery'>('image-gallery'),
      title: [galleryBlock?.title || ''],
      images: this.fb.array(
        (galleryBlock?.images.length ? galleryBlock.images : [{ src: '', caption: '' }]).map((image) =>
          this.createGalleryImageGroup(image.src, image.caption || '')
        )
      )
    });
  }

  private createGalleryImageGroup(src = '', caption = '') {
    return this.fb.nonNullable.group({
      src: [src, Validators.required],
      caption: [caption]
    });
  }

  private getGalleryImagesArray(blockIndex: number): FormArray {
    return this.biographyArray.at(blockIndex).get('images') as FormArray;
  }

  private resetFormState(record: WomanRecord): void {
    this.form.reset({
      id: record.id,
      name: record.name,
      birth: record.birth ?? null,
      death: record.death ?? null,
      region: record.region,
      city: record.city,
      century: record.century,
      shortInfo: record.shortInfo,
      latitude: record.coordinates[0] ?? 53.9,
      longitude: record.coordinates[1] ?? 27.5667,
      heroImage: record.heroImage
    }, { emitEvent: false });

    this.resetStringArray(this.categoriesArray, record.categories.length ? [...record.categories] : ['']);
    this.resetStringArray(this.imagesArray, record.images.length ? [...record.images] : ['assets/stockWoman.webp']);
    this.resetStringArray(
      this.previewImagesArray,
      record.previewImages.length ? [...record.previewImages] : ['assets/stockWoman.webp']
    );
    this.resetBiography(record.fullBiography);
  }

  private resetStringArray(array: FormArray, values: string[]): void {
    array.clear({ emitEvent: false });
    values.forEach((value) => 
      array.push(this.fb.nonNullable.control(value, Validators.required), { emitEvent: false })
    );
  }

  private resetBiography(blocks: BiographyBlock[]): void {
    this.biographyArray.clear({ emitEvent: false });
    const items = blocks.length 
      ? blocks 
      : [{ type: 'text', title: '', text: '', image: '', imageSide: 'right' } satisfies BiographyBlock];
    items.forEach((block) => 
      this.biographyArray.push(this.createBiographyGroup(block.type, block), { emitEvent: false })
    );
  }

  private cloneRecord(record: WomanRecord): WomanRecord {
    return {
      ...record,
      coordinates: [...record.coordinates] as [number, number],
      categories: [...record.categories],
      images: [...record.images],
      previewImages: [...record.previewImages],
      fullBiography: record.fullBiography.map((block) => {
        if (block.type === 'image-gallery') {
          return {
            ...block,
            images: block.images.map((image) => ({ ...image }))
          };
        }

        return { ...block };
      })
    };
  }

  private setFeedback(message: string, type: 'success' | 'error'): void {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
  }

  private readError(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Операция не выполнена. Проверьте подключение к Firebase.';
  }
}
