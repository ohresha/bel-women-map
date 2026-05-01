import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { FirebaseService } from '../../services/firebase.service';
import { BiographyBlock, WomanDetails, WomanProfile, WomanRecord } from '../../models/woman-record.model';

type BiographySectionForm = FormGroup<{
  type: FormControl<string>;
  title: FormControl<string>;
  text: FormControl<string>;
  image: FormControl<string>;
}>;

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent {
  private readonly fb = inject(FormBuilder);
  private readonly firebaseService = inject(FirebaseService);
  private readonly router = inject(Router);

  readonly user$ = this.firebaseService.user$;
  readonly records = signal<WomanRecord[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);
  readonly isCreating = signal(false);
  readonly isMobileListOpen = signal(false);
  readonly feedbackMessage = signal('');
  readonly feedbackType = signal<'success' | 'error'>('success');
  readonly formRenderKey = signal(0);
  readonly selectedRecord = computed(() =>
    this.records().find((record) => record.id === this.selectedId()) ?? null
  );

  readonly form = this.fb.group({
    id: this.fb.nonNullable.control('', [Validators.required]),
    name: this.fb.nonNullable.control('', [Validators.required]),
    birth: this.fb.control<number | null>(null, [Validators.required]),
    death: this.fb.control<number | null>(null, [Validators.required]),
    region: this.fb.nonNullable.control('', [Validators.required]),
    city: this.fb.nonNullable.control('', [Validators.required]),
    century: this.fb.nonNullable.control('', [Validators.required]),
    shortInfo: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(20)]),
    heroImage: this.fb.nonNullable.control('', [Validators.required]),
    coordinates: this.fb.array([
      this.fb.control<number | null>(null, [Validators.required]),
      this.fb.control<number | null>(null, [Validators.required])
    ]),
    categories: this.fb.array<FormControl<string>>([]),
    images: this.fb.array<FormControl<string>>([]),
    previewImages: this.fb.array<FormControl<string>>([]),
    fullBiography: this.fb.array<BiographySectionForm>([])
  });

  constructor() {
    void this.loadRecords();
  }

  get coordinatesArray(): FormArray<FormControl<number | null>> {
    return this.form.controls.coordinates;
  }

  get categoriesArray(): FormArray<FormControl<string>> {
    return this.form.controls.categories;
  }

  get imagesArray(): FormArray<FormControl<string>> {
    return this.form.controls.images;
  }

  get previewImagesArray(): FormArray<FormControl<string>> {
    return this.form.controls.previewImages;
  }

  get biographyArray(): FormArray<BiographySectionForm> {
    return this.form.controls.fullBiography;
  }

  async logout(): Promise<void> {
    await this.firebaseService.logout();
    await this.router.navigateByUrl('/login');
  }

  async save(): Promise<void> {
    if (this.form.invalid || this.isLoading() || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.setFeedback('', 'success');

    try {
      const record = this.buildRecordFromForm();
      await this.firebaseService.saveWomanRecord(record);

      const nextRecords = [...this.records()];
      const existingIndex = nextRecords.findIndex((item) => item.id === record.id);

      if (existingIndex >= 0) {
        nextRecords[existingIndex] = record;
      } else {
        nextRecords.push(record);
      }

      nextRecords.sort((left, right) => left.name.localeCompare(right.name, 'ru'));
      this.records.set(nextRecords);
      this.selectedId.set(record.id);
      this.isCreating.set(false);
      this.setFeedback('Изменения сохранены в Firebase Realtime Database.', 'success');
    } catch (error) {
      console.error(error);
      this.setFeedback('Не удалось сохранить запись. Проверьте подключение и попробуйте снова.', 'error');
    } finally {
      this.isSaving.set(false);
    }
  }

  selectRecord(recordId: string): void {
    const record = this.records().find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    this.selectedId.set(record.id);
    this.isCreating.set(false);
    this.isMobileListOpen.set(false);
    this.fillForm(record);
    this.setFeedback('', 'success');
  }

  startCreateRecord(): void {
    this.selectedId.set(null);
    this.isCreating.set(true);
    this.isMobileListOpen.set(false);
    this.fillForm();
    this.setFeedback('Создайте новую запись и сохраните её в обе ветки базы.', 'success');
  }

  addCategory(value = ''): void {
    this.categoriesArray.push(this.fb.nonNullable.control(value, [Validators.required]));
  }

  removeCategory(index: number): void {
    this.categoriesArray.removeAt(index);
    if (this.categoriesArray.length === 0) {
      this.addCategory();
    }
  }

  addImage(value = ''): void {
    this.imagesArray.push(this.fb.nonNullable.control(value, [Validators.required]));
  }

  removeImage(index: number): void {
    this.imagesArray.removeAt(index);
    if (this.imagesArray.length === 0) {
      this.addImage();
    }
  }

  addPreviewImage(value = ''): void {
    this.previewImagesArray.push(this.fb.nonNullable.control(value, [Validators.required]));
  }

  removePreviewImage(index: number): void {
    this.previewImagesArray.removeAt(index);
    if (this.previewImagesArray.length === 0) {
      this.addPreviewImage();
    }
  }

  addBiographySection(block?: BiographyBlock): void {
    this.biographyArray.push(this.createBiographyGroup(block));
  }

  removeBiographySection(index: number): void {
    this.biographyArray.removeAt(index);
    if (this.biographyArray.length === 0) {
      this.addBiographySection();
    }
  }

  toggleMobileList(): void {
    this.isMobileListOpen.set(!this.isMobileListOpen());
  }

  trackByRecord(_: number, record: WomanRecord): string {
    return record.id;
  }

  trackByIndex(index: number): number {
    return index;
  }

  trackByControl(_: number, control: AbstractControl): AbstractControl {
    return control;
  }

  controlHasError(control: AbstractControl | null, errorCode: string): boolean {
    return !!control && control.hasError(errorCode) && (control.dirty || control.touched);
  }

  private async loadRecords(): Promise<void> {
    this.isLoading.set(true);

    try {
      const data = await this.firebaseService.getWomenData();
      const mergedRecords = this.mergeWomenData(data.profiles, data.details)
        .sort((left, right) => left.name.localeCompare(right.name, 'ru'));

      this.records.set(mergedRecords);

      if (mergedRecords.length > 0) {
        this.selectRecord(mergedRecords[0].id);
      } else {
        this.startCreateRecord();
      }
    } catch (error) {
      console.error(error);
      this.records.set([]);
      this.startCreateRecord();
      this.setFeedback('Не удалось загрузить данные из Firebase.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  private fillForm(record?: WomanRecord): void {
    const nextRecord = record ?? this.createEmptyRecord();

    this.form.reset({
      id: nextRecord.id,
      name: nextRecord.name,
      birth: nextRecord.birth,
      death: nextRecord.death,
      region: nextRecord.region,
      city: nextRecord.city,
      century: nextRecord.century,
      shortInfo: nextRecord.shortInfo,
      heroImage: nextRecord.heroImage
    });

    this.form.setControl('categories', this.createStringArray(nextRecord.categories, ['']));
    this.form.setControl('images', this.createStringArray(nextRecord.images, ['assets/stockWoman.webp']));
    this.form.setControl('previewImages', this.createStringArray(nextRecord.previewImages, ['assets/stockWoman.webp']));
    this.form.setControl('coordinates', this.createCoordinatesArray(nextRecord.coordinates));
    this.form.setControl('fullBiography', this.createBiographyArray(nextRecord.fullBiography));

    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.formRenderKey.update((value) => value + 1);
  }

  private createStringArray(values: string[], fallback: string[]): FormArray<FormControl<string>> {
    const normalizedValues = values.length > 0 ? values : fallback;
    return this.fb.array(
      normalizedValues.map((value) => this.fb.nonNullable.control(value, [Validators.required]))
    );
  }

  private createCoordinatesArray(values: [number, number]): FormArray<FormControl<number | null>> {
    return this.fb.array(
      values.map((value) => this.fb.control<number | null>(value, [Validators.required]))
    );
  }

  private createBiographyArray(blocks: BiographyBlock[]): FormArray<BiographySectionForm> {
    const normalizedBlocks = blocks.length > 0 ? blocks : [undefined];
    return this.fb.array(
      normalizedBlocks.map((block) => this.createBiographyGroup(block))
    );
  }

  private createBiographyGroup(block?: BiographyBlock): BiographySectionForm {
    return this.fb.group({
      type: this.fb.nonNullable.control(block?.type ?? 'text', [Validators.required]),
      title: this.fb.nonNullable.control(this.extractBiographyTitle(block), [Validators.required]),
      text: this.fb.nonNullable.control(this.extractBiographyText(block), [Validators.required]),
      image: this.fb.nonNullable.control(this.extractBiographyImage(block))
    }) as BiographySectionForm;
  }

  private buildRecordFromForm(): WomanRecord {
    const rawValue = this.form.getRawValue();
    const categories = this.normalizeStringList(rawValue.categories);
    const images = this.normalizeStringList(rawValue.images);
    const previewImages = this.normalizeStringList(rawValue.previewImages);
    const coordinates = rawValue.coordinates.map((value) => Number(value)) as [number, number];

    return {
      id: rawValue.id.trim(),
      name: rawValue.name.trim(),
      birth: Number(rawValue.birth),
      death: Number(rawValue.death),
      region: rawValue.region.trim(),
      city: rawValue.city.trim(),
      century: rawValue.century.trim(),
      shortInfo: rawValue.shortInfo.trim(),
      coordinates,
      categories,
      images: images.length > 0 ? images : [rawValue.heroImage.trim()],
      heroImage: rawValue.heroImage.trim(),
      previewImages: previewImages.length > 0 ? previewImages : [rawValue.heroImage.trim()],
      fullBiography: rawValue.fullBiography.map((section) => this.mapBiographySection(section))
    };
  }

  private mapBiographySection(section: { type: string; title: string; text: string; image: string }): BiographyBlock {
    const type = section.type.trim();
    const title = section.title.trim();
    const text = section.text.trim();
    const image = section.image.trim();

    if (type === 'quote') {
      return {
        type: 'quote',
        text,
        author: title || undefined
      };
    }

    if (type === 'image-gallery') {
      return {
        type: 'image-gallery',
        title,
        images: image ? [{ src: image, caption: text }] : []
      };
    }

    return {
      type: 'text',
      title,
      text,
      image
    };
  }

  private normalizeStringList(values: string[]): string[] {
    return values
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private mergeWomenData(profiles: WomanProfile[], details: WomanDetails[]): WomanRecord[] {
    const detailsMap = new Map(details.map((item) => [item.id, item]));
    const records = profiles.map((profile) => {
      const detail = detailsMap.get(profile.id);
      return {
        ...profile,
        heroImage: detail?.heroImage || profile.images[0] || 'assets/stockWoman.webp',
        previewImages: detail?.previewImages?.length ? detail.previewImages : profile.images,
        fullBiography: detail?.fullBiography ?? []
      };
    });

    details.forEach((detail) => {
      if (records.some((record) => record.id === detail.id)) {
        return;
      }

      records.push({
        ...this.createEmptyRecord(),
        id: detail.id,
        name: detail.id.replaceAll('_', ' '),
        heroImage: detail.heroImage,
        previewImages: detail.previewImages,
        fullBiography: detail.fullBiography
      });
    });

    return records;
  }

  private createEmptyRecord(): WomanRecord {
    return {
      id: '',
      name: '',
      birth: new Date().getFullYear(),
      death: new Date().getFullYear(),
      region: '',
      city: '',
      century: '',
      shortInfo: '',
      coordinates: [53.9, 27.5667],
      categories: [''],
      images: ['assets/stockWoman.webp'],
      heroImage: 'assets/stockWoman.webp',
      previewImages: ['assets/stockWoman.webp'],
      fullBiography: [
        {
          type: 'text',
          title: '',
          text: '',
          image: ''
        }
      ]
    };
  }

  private extractBiographyTitle(block?: BiographyBlock): string {
    if (!block) {
      return '';
    }

    if (block.type === 'quote') {
      return block.author ?? '';
    }

    return block.title ?? '';
  }

  private extractBiographyText(block?: BiographyBlock): string {
    if (!block) {
      return '';
    }

    if (block.type === 'image-gallery') {
      return block.images[0]?.caption ?? '';
    }

    return block.text ?? '';
  }

  private extractBiographyImage(block?: BiographyBlock): string {
    if (!block) {
      return '';
    }

    if (block.type === 'text') {
      return block.image ?? '';
    }

    if (block.type === 'image-gallery') {
      return block.images[0]?.src ?? '';
    }

    return '';
  }

  private setFeedback(message: string, type: 'success' | 'error'): void {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
  }
}
