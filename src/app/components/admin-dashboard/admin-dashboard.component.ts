import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, ElementRef, inject, signal, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { FirebaseService } from '../../services/firebase.service';
import { ImageUploadService } from '../../services/image-upload.service';
import { BiographyBlock, WomanDetails, WomanProfile, WomanRecord } from '../../models/woman-record.model';
import { distinctUntilChanged, finalize } from 'rxjs';

type BiographySectionForm = FormGroup<{
  title: FormControl<string>;
  text: FormControl<string>;
  image: FormControl<string>;
}>;

// Validates that birth year <= death year
const YEARS_ORDER_VALIDATOR: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const birth = Number(control.get('birth')?.value);
  const deathValue = control.get('death')?.value;

  if (!Number.isFinite(birth) || deathValue === null || deathValue === '') {
    return null;
  }

  const death = Number(deathValue);
  return !Number.isFinite(death) || birth <= death ? null : { yearsOrder: true };
};

@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, RouterLink, ReactiveFormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent {
  @ViewChild('coordinatePickerMap') private coordinatePickerMap?: ElementRef<HTMLDivElement>;

  private readonly fb = inject(FormBuilder);
  private readonly firebaseService = inject(FirebaseService);
  private readonly imageUploadService = inject(ImageUploadService);
  private readonly router = inject(Router);
  private coordinateMap?: L.Map;
  private coordinateMarker?: L.Marker;
  private coordinateMapTimerId?: number;

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
  readonly searchQuery = signal('');
  readonly editingSourceId = signal<string | null>(null);
  readonly imageInputModes = signal<Record<string, 'url' | 'upload'>>({});
  readonly uploadingStates = signal<Record<string, boolean>>({});
  readonly uploadErrors = signal<Record<string, string>>({});
  readonly isCoordinatePickerOpen = signal(false);
  readonly draftCoordinates = signal<[number, number] | null>(null);

  readonly belarusRegions = [
    'Брестская область',
    'Витебская область',
    'Гомельская область',
    'Гродненская область',
    'Минская область',
    'Могилёвская область'
  ];
  readonly categoryOptions = [
    'Наука',
    'Искусство',
    'Литература',
    'Спорт',
    'Просвещение',
    'Политика'
  ];
  readonly centuries = Array.from({ length: 12 }, (_, i) => `${i + 10} век`);

  readonly selectedRecord = computed(() =>
    this.records().find((r) => r.id === this.selectedId()) ?? null
  );
  readonly filteredRecords = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('ru');
    return query
      ? this.records().filter((r) => r.name.toLocaleLowerCase('ru').includes(query))
      : this.records();
  });

  // FIX: removed Validators.required from disabled `id` control —
  // Angular still marks the form invalid when a disabled control fails required
  // validation, even though the user cannot interact with it.
  readonly form = this.fb.group({
    id: this.fb.nonNullable.control({ value: '', disabled: true }),
    name: this.fb.nonNullable.control('', [Validators.required]),
    birth: this.fb.control<number | null>(null, [Validators.required]),
    death: this.fb.control<number | null>(null),
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
  }, { validators: [YEARS_ORDER_VALIDATOR] });

  constructor() {
    this.form.controls.name.valueChanges
      .pipe(distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((name) => {
        this.form.controls.id.setValue(this.buildIdFromName(name), { emitEvent: false });
      });

    void this.loadRecords();
  }

  ngOnDestroy(): void {
    this.destroyCoordinateMap();
  }

  // ─── FormArray getters ────────────────────────────────────────────────────

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

  get shortCardImagesPreview(): FormControl<string>[] {
    return this.previewImagesArray.controls.slice(0, 3);
  }

  get biographyArray(): FormArray<BiographySectionForm> {
    return this.form.controls.fullBiography;
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async logout(): Promise<void> {
    await this.firebaseService.logout();
    await this.router.navigateByUrl('/login');
  }

  // ─── Coordinate picker ────────────────────────────────────────────────────

  openCoordinatePicker(): void {
    const coords = this.getCurrentCoordinates();
    this.draftCoordinates.set(coords);
    this.isCoordinatePickerOpen.set(true);

    if (typeof window !== 'undefined') {
      window.clearTimeout(this.coordinateMapTimerId);
      this.coordinateMapTimerId = window.setTimeout(() => this.initializeCoordinateMap(coords), 0);
    }
  }

  closeCoordinatePicker(): void {
    this.isCoordinatePickerOpen.set(false);
    this.destroyCoordinateMap();
  }

  confirmCoordinateSelection(): void {
    const coordinates = this.draftCoordinates();
    if (!coordinates) return;

    const [lat, lng] = coordinates.map((v) => Number(v.toFixed(6))) as [number, number];
    this.form.patchValue({ coordinates: [lat, lng] });
    this.coordinatesArray.controls.forEach((ctrl) => {
      ctrl.markAsDirty();
      ctrl.markAsTouched();
    });
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
    this.setFeedback('Координаты обновлены по выбранной точке на карте.', 'success');
    this.closeCoordinatePicker();
  }

  // ─── Save / select / create ───────────────────────────────────────────────

  async save(): Promise<void> {
    console.log('form.invalid:', this.form.invalid);
  console.log('form.status:', this.form.status);
  
  const logInvalid = (control: AbstractControl, path = 'form') => {
    if (control instanceof FormGroup || control instanceof FormArray) {
      Object.entries((control as any).controls).forEach(([key, child]) => {
        logInvalid(child as AbstractControl, `${path}.${key}`);
      });
    }
    if (control.invalid) {
      console.warn(`INVALID: ${path}`, {
        status: control.status,
        errors: control.errors,
        value: control.value
      });
    }
  };
  logInvalid(this.form);
    
    
    
    
    
    
    
    
    
    if (this.hasActiveUploads()) {
      this.setFeedback('Дождитесь завершения загрузки изображений, прежде чем сохранять запись.', 'error');
      return;
    }

    if (this.form.invalid || this.isLoading() || this.isSaving()) {
      this.form.markAllAsTouched();
      this.setFeedback('Проверьте обязательные поля перед сохранением.', 'error');
      return;
    }

    this.isSaving.set(true);
    this.setFeedback('', 'success');

    try {
      const record = this.buildRecordFromForm();
      const originalId = this.editingSourceId();
      await this.firebaseService.saveWomanRecord(record, originalId);

      const nextRecords = [...this.records()];
      const existingIndex = nextRecords.findIndex((r) => r.id === (originalId ?? record.id));

      existingIndex >= 0
        ? (nextRecords[existingIndex] = record)
        : nextRecords.push(record);

      nextRecords.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
      this.records.set(nextRecords);
      this.selectedId.set(record.id);
      this.editingSourceId.set(record.id);
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
    const record = this.records().find((r) => r.id === recordId);
    if (!record) return;

    this.selectedId.set(record.id);
    this.editingSourceId.set(record.id);
    this.isCreating.set(false);
    this.isMobileListOpen.set(false);
    this.fillForm(record);
    this.setFeedback('', 'success');
  }

  startCreateRecord(): void {
    this.selectedId.set(null);
    this.editingSourceId.set(null);
    this.isCreating.set(true);
    this.isMobileListOpen.set(false);
    this.fillForm();
    this.setFeedback('Создайте новую запись и сохраните её в обе ветки базы.', 'success');
  }

  // ─── Categories ───────────────────────────────────────────────────────────

  addCategory(value = ''): void {
    const v = value.trim();
    if (!v || this.categoriesArray.value.includes(v)) return;

    this.categoriesArray.push(this.fb.nonNullable.control(v));
    this.markArrayDirty(this.categoriesArray);
  }

  removeCategory(index: number): void {
    this.categoriesArray.removeAt(index);
    this.markArrayDirty(this.categoriesArray);
  }

  addCategoryFromSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.addCategory(select.value);
    select.value = '';
  }

  isCategorySelected(category: string): boolean {
    return this.categoriesArray.value.includes(category);
  }

  // ─── Image arrays ─────────────────────────────────────────────────────────

  addImage(value = ''): void {
    this.imagesArray.push(this.fb.nonNullable.control(value, [Validators.required]));
  }

  removeImage(index: number): void {
    this.imagesArray.removeAt(index);
    if (this.imagesArray.length === 0) this.addImage();
  }

  addPreviewImage(value = ''): void {
    this.previewImagesArray.push(this.fb.nonNullable.control(value, [Validators.required]));
  }

  removePreviewImage(index: number): void {
    this.previewImagesArray.removeAt(index);
    if (this.previewImagesArray.length === 0) this.addPreviewImage();
  }

  // ─── Biography ────────────────────────────────────────────────────────────

  addBiographySection(block?: BiographyBlock): void {
    this.biographyArray.push(this.createBiographyGroup(block));
  }

  removeBiographySection(index: number): void {
    this.biographyArray.removeAt(index);
    if (this.biographyArray.length === 0) this.addBiographySection();
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────

  toggleMobileList(): void {
    this.isMobileListOpen.update((v) => !v);
  }

  updateSearch(query: string): void {
    this.searchQuery.set(query);
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

  sanitizeYearInput(controlName: 'birth' | 'death', event: Event): void {
    const input = event.target as HTMLInputElement;
    const digitsOnly = input.value.replace(/\D+/g, '').slice(0, 4);
    input.value = digitsOnly;
    this.form.controls[controlName].setValue(digitsOnly ? Number(digitsOnly) : null);
    this.form.controls[controlName].markAsDirty();
    this.form.controls[controlName].markAsTouched();
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
  }

  // ─── Image upload / input mode ────────────────────────────────────────────

  getImageInputMode(fieldKey: string): 'url' | 'upload' {
    return this.imageInputModes()[fieldKey] ?? 'url';
  }

  setImageInputMode(fieldKey: string, mode: 'url' | 'upload'): void {
    this.imageInputModes.update((s) => ({ ...s, [fieldKey]: mode }));
    this.clearUploadError(fieldKey);
  }

  isImageUploading(fieldKey: string): boolean {
    return this.uploadingStates()[fieldKey] ?? false;
  }

  hasUploadingImages(): boolean {
    return this.hasActiveUploads();
  }

  getUploadError(fieldKey: string): string {
    return this.uploadErrors()[fieldKey] ?? '';
  }

  getImagePreview(value: string | null | undefined): string | null {
    const v = value?.trim() ?? '';
    return v || null;
  }

  getFieldKey(section: 'images' | 'previewImages' | 'fullBiography', index: number): string {
    return section === 'fullBiography' ? `fullBiography:${index}:image` : `${section}:${index}`;
  }

  uploadImageForControl(event: Event, control: FormControl<string>, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.setUploadingState(fieldKey, true);
    this.clearUploadError(fieldKey);

    this.imageUploadService.uploadImage(file)
      .pipe(finalize(() => {
        this.setUploadingState(fieldKey, false);
        input.value = '';
      }))
      .subscribe({
        next: (imageUrl) => {
          control.setValue(imageUrl);
          control.markAsDirty();
          control.markAsTouched();
          this.setFeedback('Изображение успешно загружено в ImgBB.', 'success');
        },
        error: (error: unknown) => {
          console.error(error);
          const message = error instanceof Error
            ? error.message
            : 'Не удалось загрузить изображение. Попробуйте выбрать другой файл.';
          this.setUploadError(fieldKey, message);
          this.setFeedback(message, 'error');
        }
      });
  }

  // ─── Private: data loading ────────────────────────────────────────────────

  private async loadRecords(): Promise<void> {
    this.isLoading.set(true);

    try {
      const data = await this.firebaseService.getWomenData();
      const mergedRecords = this.mergeWomenData(data.profiles, data.details)
        .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

      this.records.set(mergedRecords);
      mergedRecords.length > 0
        ? this.selectRecord(mergedRecords[0].id)
        : this.startCreateRecord();
    } catch (error) {
      console.error(error);
      this.records.set([]);
      this.startCreateRecord();
      this.setFeedback('Не удалось загрузить данные из Firebase.', 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ─── Private: form ────────────────────────────────────────────────────────

  private fillForm(record?: WomanRecord): void {
    const r = record ?? this.createEmptyRecord();
    this.closeCoordinatePicker();

    this.form.reset({
      id: r.id,
      name: r.name,
      birth: r.birth,
      death: r.death,
      region: r.region,
      city: r.city,
      century: r.century,
      shortInfo: r.shortInfo,
      heroImage: r.heroImage
    });

    this.form.setControl('categories', this.createCategoriesArray(r.categories));
    this.form.setControl('images', this.createStringArray(r.images, ['assets/stockWoman.webp']));
    this.form.setControl('previewImages', this.createStringArray(r.previewImages, ['assets/stockWoman.webp']));
    this.form.setControl('coordinates', this.createCoordinatesArray(r.coordinates));
    this.form.setControl('fullBiography', this.createBiographyArray(r.fullBiography));

    this.imageInputModes.set({});
    this.uploadingStates.set({});
    this.uploadErrors.set({});

    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
    this.formRenderKey.update((v) => v + 1);
  }

  private createStringArray(values: string[], fallback: string[]): FormArray<FormControl<string>> {
    const normalized = values.length > 0 ? values : fallback;
    return this.fb.array(
      normalized.map((v) => this.fb.nonNullable.control(v, [Validators.required]))
    );
  }

  private createCategoriesArray(values: string[]): FormArray<FormControl<string>> {
    const unique = this.normalizeStringList(values).filter((v, i, arr) => arr.indexOf(v) === i);
    return this.fb.array(unique.map((v) => this.fb.nonNullable.control(v)));
  }

  private createCoordinatesArray(values: [number, number]): FormArray<FormControl<number | null>> {
    return this.fb.array(
      values.map((v) => this.fb.control<number | null>(v, [Validators.required]))
    );
  }

  private createBiographyArray(blocks: BiographyBlock[]): FormArray<BiographySectionForm> {
    const normalized = blocks.length > 0 ? blocks : [undefined];
    return this.fb.array(normalized.map((b) => this.createBiographyGroup(b)));
  }

  private createBiographyGroup(block?: BiographyBlock): BiographySectionForm {
    return this.fb.group({
      title: this.fb.nonNullable.control(block?.type === 'text' ? block.title ?? '' : '', [Validators.required]),
      text: this.fb.nonNullable.control(block?.type === 'text' ? block.text ?? '' : '', [Validators.required]),
      image: this.fb.nonNullable.control(block?.type === 'text' ? block.image ?? '' : '')
    }) as BiographySectionForm;
  }

  private buildRecordFromForm(): WomanRecord {
    const raw = this.form.getRawValue();
    const categories = this.normalizeStringList(raw.categories);
    const heroImage = raw.heroImage.trim();
    const previewImages = this.normalizeStringList(raw.previewImages);
    const coordinates = raw.coordinates.map(Number) as [number, number];

    return {
      id: this.form.controls.id.getRawValue().trim(),
      name: raw.name.trim(),
      birth: Number(raw.birth),
      death: raw.death === null ? null : Number(raw.death),
      region: raw.region.trim(),
      city: raw.city.trim(),
      century: raw.century.trim(),
      shortInfo: raw.shortInfo.trim(),
      coordinates,
      categories,
      images: previewImages.slice(0, 3).length > 0 ? previewImages.slice(0, 3) : [heroImage],
      heroImage,
      previewImages: previewImages.length > 0 ? previewImages : [heroImage],
      fullBiography: raw.fullBiography.map(({ title, text, image }) => ({
        type: 'text' as const,
        title: title.trim(),
        text: text.trim(),
        image: image.trim()
      }))
    };
  }

  private normalizeStringList(values: string[]): string[] {
    return values.map((v) => v.trim()).filter(Boolean);
  }

  private mergeWomenData(profiles: WomanProfile[], details: WomanDetails[]): WomanRecord[] {
    const detailsMap = new Map(details.map((d) => [d.id, d]));
    const records = profiles.map((profile) => {
      const detail = detailsMap.get(profile.id);
      return {
        ...profile,
        heroImage: detail?.heroImage || profile.images[0] || 'assets/stockWoman.webp',
        previewImages: detail?.previewImages?.length ? detail.previewImages : profile.images,
        fullBiography: detail?.fullBiography ?? []
      };
    });

    const recordIds = new Set(records.map((r) => r.id));
    details
      .filter((d) => !recordIds.has(d.id))
      .forEach((d) => {
        records.push({
          ...this.createEmptyRecord(),
          id: d.id,
          name: d.id.replaceAll('_', ' '),
          heroImage: d.heroImage,
          previewImages: d.previewImages,
          fullBiography: d.fullBiography
        });
      });

    return records;
  }

  // FIX: categories is now [] instead of [''] to avoid empty-string entries
  private createEmptyRecord(): WomanRecord {
    return {
      id: '',
      name: '',
      birth: new Date().getFullYear(),
      death: null,
      region: this.belarusRegions[4],
      city: '',
      century: this.centuries[0],
      shortInfo: '',
      coordinates: [53.9, 27.5667],
      categories: [],
      images: ['assets/stockWoman.webp'],
      heroImage: 'assets/stockWoman.webp',
      previewImages: ['assets/stockWoman.webp'],
      fullBiography: [{ type: 'text', title: '', text: '', image: '' }]
    };
  }

  // ─── Private: coordinate map ──────────────────────────────────────────────

  private getCurrentCoordinates(): [number, number] {
    const [lat, lng] = this.form.getRawValue().coordinates.map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : [53.9, 27.5667];
  }

  private initializeCoordinateMap(initialCoordinates: [number, number]): void {
    const mapHost = this.coordinatePickerMap?.nativeElement;
    if (!mapHost) return;

    this.destroyCoordinateMap();

    this.coordinateMap = L.map(mapHost, {
      attributionControl: false,
      zoomControl: true,
      preferCanvas: true
    }).setView(initialCoordinates, 7);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 5,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.coordinateMap);

    this.coordinateMap.on('click', (event: L.LeafletMouseEvent) => {
      const coords: [number, number] = [event.latlng.lat, event.latlng.lng];
      this.draftCoordinates.set(coords);
      this.renderCoordinateMarker(coords);
    });

    this.renderCoordinateMarker(initialCoordinates);

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        this.coordinateMap?.invalidateSize();
        this.coordinateMap?.setView(
          this.draftCoordinates() ?? initialCoordinates,
          this.coordinateMap?.getZoom() ?? 7
        );
      }, 150);
    }
  }

  private renderCoordinateMarker(coordinates: [number, number]): void {
    if (!this.coordinateMap) return;

    if (!this.coordinateMarker) {
      this.coordinateMarker = L.marker(coordinates, {
        icon: L.divIcon({
          className: 'coordinate-picker-marker',
          html: '<span class="coordinate-picker-marker__dot"></span>',
          iconSize: [28, 28],
          iconAnchor: [14, 28]
        })
      }).addTo(this.coordinateMap);
    } else {
      this.coordinateMarker.setLatLng(coordinates);
    }

    this.coordinateMap.panTo(coordinates, { animate: true, duration: 0.35 });
  }

  private destroyCoordinateMap(): void {
    this.coordinateMarker?.remove();
    this.coordinateMarker = undefined;
    this.coordinateMap?.remove();
    this.coordinateMap = undefined;

    if (typeof window !== 'undefined') {
      window.clearTimeout(this.coordinateMapTimerId);
      this.coordinateMapTimerId = undefined;
    }
  }

  // ─── Private: upload state ────────────────────────────────────────────────

  private hasActiveUploads(): boolean {
    return Object.values(this.uploadingStates()).some(Boolean);
  }

  private setUploadingState(fieldKey: string, isUploading: boolean): void {
    this.uploadingStates.update((s) => ({ ...s, [fieldKey]: isUploading }));
  }

  private setUploadError(fieldKey: string, message: string): void {
    this.uploadErrors.update((s) => ({ ...s, [fieldKey]: message }));
  }

  private clearUploadError(fieldKey: string): void {
    this.uploadErrors.update((s) => {
      if (!(fieldKey in s)) return s;
      const next = { ...s };
      delete next[fieldKey];
      return next;
    });
  }

  // ─── Private: misc helpers ────────────────────────────────────────────────

  private buildIdFromName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\p{L}\p{N}_-]/gu, '')
      .replace(/_+/g, '_');
  }

  private setFeedback(message: string, type: 'success' | 'error'): void {
    this.feedbackMessage.set(message);
    this.feedbackType.set(type);
  }

  private markArrayDirty(array: FormArray): void {
    array.markAsDirty();
    array.markAsTouched();
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
  }
}