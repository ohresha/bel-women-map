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

const YEARS_ORDER_VALIDATOR: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const birth = Number(control.get('birth')?.value);
  const deathValue = control.get('death')?.value;

  if (!Number.isFinite(birth) || deathValue === null || deathValue === '') {
    return null;
  }

  const death = Number(deathValue);
  if (!Number.isFinite(death)) {
    return null;
  }

  return birth <= death ? null : { yearsOrder: true };
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
  readonly centuries = Array.from({ length: 12 }, (_, index) => `${index + 10} век`);
  readonly selectedRecord = computed(() =>
    this.records().find((record) => record.id === this.selectedId()) ?? null
  );
  readonly filteredRecords = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('ru');

    if (!query) {
      return this.records();
    }

    return this.records().filter((record) => record.name.toLocaleLowerCase('ru').includes(query));
  });

  readonly form = this.fb.group({
    id: this.fb.nonNullable.control({ value: '', disabled: true }, [Validators.required]),
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

  openCoordinatePicker(): void {
    const currentCoordinates = this.getCurrentCoordinates();
    this.draftCoordinates.set(currentCoordinates);
    this.isCoordinatePickerOpen.set(true);

    if (typeof window !== 'undefined') {
      window.clearTimeout(this.coordinateMapTimerId);
      this.coordinateMapTimerId = window.setTimeout(() => {
        this.initializeCoordinateMap(currentCoordinates);
      }, 0);
    }
  }

  closeCoordinatePicker(): void {
    this.isCoordinatePickerOpen.set(false);
    this.destroyCoordinateMap();
  }

  confirmCoordinateSelection(): void {
    const coordinates = this.draftCoordinates();
    if (!coordinates) {
      return;
    }

    const [lat, lng] = coordinates.map((value) => Number(value.toFixed(6))) as [number, number];
    this.form.patchValue({
      coordinates: [lat, lng]
    });
    this.coordinatesArray.controls.forEach((control) => {
      control.markAsDirty();
      control.markAsTouched();
    });
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
    this.setFeedback('Координаты обновлены по выбранной точке на карте.', 'success');
    this.closeCoordinatePicker();
  }

  async save(): Promise<void> {
    if (this.hasActiveUploads()) {
      this.setFeedback('Дождитесь завершения загрузки изображений, прежде чем сохранять запись.', 'error');
      return;
    }

    if (this.form.invalid || this.isLoading() || this.isSaving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.setFeedback('', 'success');

    try {
      const record = this.buildRecordFromForm();
      const originalId = this.editingSourceId();
      await this.firebaseService.saveWomanRecord(record, originalId);

      const nextRecords = [...this.records()];
      const existingIndex = nextRecords.findIndex((item) => item.id === (originalId ?? record.id));

      if (existingIndex >= 0) {
        nextRecords[existingIndex] = record;
      } else {
        nextRecords.push(record);
      }

      nextRecords.sort((left, right) => left.name.localeCompare(right.name, 'ru'));
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
    const record = this.records().find((item) => item.id === recordId);
    if (!record) {
      return;
    }

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

  addCategory(value = ''): void {
    const normalizedValue = value.trim();

    if (!normalizedValue || this.categoriesArray.value.includes(normalizedValue)) {
      return;
    }

    this.categoriesArray.push(this.fb.nonNullable.control(normalizedValue));
    this.categoriesArray.markAsDirty();
    this.categoriesArray.markAsTouched();
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
  }

  removeCategory(index: number): void {
    this.categoriesArray.removeAt(index);
    this.categoriesArray.markAsDirty();
    this.categoriesArray.markAsTouched();
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
  }

  addCategoryFromSelect(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const nextValue = select.value;
    this.addCategory(nextValue);
    select.value = '';
  }

  isCategorySelected(category: string): boolean {
    return this.categoriesArray.value.includes(category);
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

  getImageInputMode(fieldKey: string): 'url' | 'upload' {
    return this.imageInputModes()[fieldKey] ?? 'url';
  }

  setImageInputMode(fieldKey: string, mode: 'url' | 'upload'): void {
    this.imageInputModes.update((state) => ({
      ...state,
      [fieldKey]: mode
    }));
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
    const normalizedValue = value?.trim() ?? '';
    return normalizedValue ? normalizedValue : null;
  }

  getFieldKey(section: 'images' | 'previewImages' | 'fullBiography', index: number): string {
    if (section === 'fullBiography') {
      return `fullBiography:${index}:image`;
    }

    return `${section}:${index}`;
  }

  uploadImageForControl(event: Event, control: FormControl<string>, fieldKey: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

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
    this.closeCoordinatePicker();

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

    this.form.setControl('categories', this.createCategoriesArray(nextRecord.categories));
    this.form.setControl('images', this.createStringArray(nextRecord.images, ['assets/stockWoman.webp']));
    this.form.setControl('previewImages', this.createStringArray(nextRecord.previewImages, ['assets/stockWoman.webp']));
    this.form.setControl('coordinates', this.createCoordinatesArray(nextRecord.coordinates));
    this.form.setControl('fullBiography', this.createBiographyArray(nextRecord.fullBiography));
    this.imageInputModes.set({});
    this.uploadingStates.set({});
    this.uploadErrors.set({});

    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.form.updateValueAndValidity({ onlySelf: false, emitEvent: false });
    this.formRenderKey.update((value) => value + 1);
  }

  private createStringArray(values: string[], fallback: string[]): FormArray<FormControl<string>> {
    const normalizedValues = values.length > 0 ? values : fallback;
    return this.fb.array(
      normalizedValues.map((value) => this.fb.nonNullable.control(value, [Validators.required]))
    );
  }

  private createCategoriesArray(values: string[]): FormArray<FormControl<string>> {
    const normalizedValues = this.normalizeStringList(values)
      .filter((value, index, array) => array.indexOf(value) === index);

    return this.fb.array(
      normalizedValues.map((value) => this.fb.nonNullable.control(value))
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
      id: this.form.controls.id.getRawValue().trim(),
      name: rawValue.name.trim(),
      birth: Number(rawValue.birth),
      death: rawValue.death === null ? null : Number(rawValue.death),
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

  private mapBiographySection(section: { title: string; text: string; image: string }): BiographyBlock {
    const title = section.title.trim();
    const text = section.text.trim();
    const image = section.image.trim();

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
      death: null,
      region: this.belarusRegions[4],
      city: '',
      century: this.centuries[0],
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

    return block.type === 'text' ? block.title ?? '' : '';
  }

  private extractBiographyText(block?: BiographyBlock): string {
    if (!block) {
      return '';
    }

    return block.type === 'text' ? block.text ?? '' : '';
  }

  private extractBiographyImage(block?: BiographyBlock): string {
    if (!block) {
      return '';
    }

    return block.type === 'text' ? block.image ?? '' : '';
  }

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

  private getCurrentCoordinates(): [number, number] {
    const rawCoordinates = this.form.getRawValue().coordinates;
    const lat = Number(rawCoordinates[0]);
    const lng = Number(rawCoordinates[1]);

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return [lat, lng];
    }

    return [53.9, 27.5667];
  }

  private initializeCoordinateMap(initialCoordinates: [number, number]): void {
    const mapHost = this.coordinatePickerMap?.nativeElement;
    if (!mapHost) {
      return;
    }

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
      const nextCoordinates: [number, number] = [event.latlng.lat, event.latlng.lng];
      this.draftCoordinates.set(nextCoordinates);
      this.renderCoordinateMarker(nextCoordinates);
    });

    this.renderCoordinateMarker(initialCoordinates);

    if (typeof window !== 'undefined') {
      window.setTimeout(() => {
        this.coordinateMap?.invalidateSize();
        this.coordinateMap?.setView(this.draftCoordinates() ?? initialCoordinates, this.coordinateMap?.getZoom() ?? 7);
      }, 150);
    }
  }

  private renderCoordinateMarker(coordinates: [number, number]): void {
    if (!this.coordinateMap) {
      return;
    }

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

  private hasActiveUploads(): boolean {
    return Object.values(this.uploadingStates()).some(Boolean);
  }

  private setUploadingState(fieldKey: string, isUploading: boolean): void {
    this.uploadingStates.update((state) => ({
      ...state,
      [fieldKey]: isUploading
    }));
  }

  private setUploadError(fieldKey: string, message: string): void {
    this.uploadErrors.update((state) => ({
      ...state,
      [fieldKey]: message
    }));
  }

  private clearUploadError(fieldKey: string): void {
    this.uploadErrors.update((state) => {
      if (!(fieldKey in state)) {
        return state;
      }

      const nextState = { ...state };
      delete nextState[fieldKey];
      return nextState;
    });
  }
}
