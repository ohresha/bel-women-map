import { NgFor, NgIf } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import * as L from 'leaflet';
// import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/leaflet.markercluster-src.js';
import { MapDataService, MapFilters, WomanDetails, WomanProfile } from '../../services/map-data.service';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-map-component',
  imports: [FormsModule, NgFor, NgIf, RouterLink],
  templateUrl: './map-component.html',
  styleUrl: './map-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush // ИЗУЧИТЬ
})

export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('filtersPanel') filtersPanel!: ElementRef<HTMLElement>;
  @ViewChild('previewPanel') previewPanel!: ElementRef<HTMLElement>;
  @ViewChild('filtersToggle') filtersToggle!: ElementRef<HTMLButtonElement>;
  
  private map?: L.Map;
  private markersLayer?: any;
  private maskLayer?: L.GeoJSON;
  private bordersLayer?: L.GeoJSON;
  private timerId?: number;
  private suppressOutsideClick = false;
  private markerById = new Map<string, L.Marker>();
  private detailsCache = new Map<string, WomanDetails>();
  private detailsRequested = new Set<string>();

  regions: any;
  categories: any;

  constructor(
    private readonly mapData: MapDataService,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    this.regions = this.mapData.getRegions();
    this.categories = this.mapData.getCategories();
  }

  filters: MapFilters = {
    regions: [],
    categories: [],
    centuries: [] // legacy: заменено временной лентой
  };

  private allWomen: WomanProfile[] = [];
  filteredWomen: WomanProfile[] = [];
  selectedWoman?: WomanProfile;
  isFiltersOpen = false;
  isPreviewOpen = false;
  activeImageIndex = 0;

  readonly timelineMin = 10;
  readonly timelineMax = 21;
  isAllTime = true;
  selectedCentury = 21;

  get selectedCenturyLabel(): string {
    return `${this.toRomanCentury(this.selectedCentury)} век`;
  }

  get timelineMinLabel(): string {
    return this.toRomanCentury(this.timelineMin);
  }

  get timelineMaxLabel(): string {
    return this.toRomanCentury(this.timelineMax);
  }

  ngAfterViewInit(): void {
    this.isFiltersOpen = !window.matchMedia('(max-width: 900px)').matches;
    this.cdr.markForCheck();
    this.initMap();
    this.mapData.getAllProfiles().subscribe((profiles) => {
      this.allWomen = profiles;
      this.applyFilters();
    });
  }

  ngOnDestroy(): void {
    this.map?.remove();
    if (this.timerId) {
      window.clearTimeout(this.timerId);
    }
  }

  toggleFilters(): void {
    this.isFiltersOpen = !this.isFiltersOpen;
    if (this.isFiltersOpen) {
      this.isPreviewOpen = false;
      this.selectedWoman = undefined;
      this.activeImageIndex = 0;
    }
    this.deferResize();
  }

  closeFilters(): void {
    this.isFiltersOpen = false;
    this.deferResize();
  }

  closePreview(): void {
    this.isPreviewOpen = false;
    this.selectedWoman = undefined;
    this.activeImageIndex = 0;
  }

  goHome(): void {
    void this.router.navigate(['/']);
  }

  toggleRegion(region: string): void {
    this.toggleValue(this.filters.regions, region);
    this.applyFilters();
  }

  toggleCategory(category: string): void {
    this.toggleValue(this.filters.categories, category);
    this.applyFilters();
  }

  onTimelineChange(): void {
    this.applyFilters();
  }

  onTimelineInput(event: Event): void {
    const raw = (event.target as HTMLInputElement | null)?.value ?? `${this.selectedCentury}`;
    const next = Number.parseInt(raw, 10);
    if (Number.isFinite(next)) {
      this.selectedCentury = next;
    }
    this.applyFilters();
  }

  isSelected(list: string[], value: string): boolean {
    return list.includes(value);
  }

  private toggleValue(list: string[], value: string): void {
    const index = list.indexOf(value);
    if (index >= 0) {
      list.splice(index, 1);
    } else {
      list.push(value);
    }
  }

  private applyFilters(): void {
    const data = this.allWomen.filter((woman) => {
      const matchesRegion = this.filters.regions.length === 0 || this.filters.regions.includes(woman.region);
      const matchesCategories =
        this.filters.categories.length === 0 || this.filters.categories.some((cat) => woman.categories.includes(cat));
      const matchesTimeline = this.matchesTimeline(woman);

      return matchesRegion && matchesCategories && matchesTimeline;
    });

    this.filteredWomen = data;
    if (this.selectedWoman && !this.filteredWomen.find((item) => item.id === this.selectedWoman?.id)) {
      this.selectedWoman = undefined;
      this.isPreviewOpen = false;
      this.activeImageIndex = 0;
    }

    this.renderMarkers();
    this.cdr.markForCheck();
  }

  // private initMap(): void {
  //   this.map = L.map(this.mapContainer.nativeElement, {
  //     zoomControl: true,
  //     preferCanvas: true,
      
  //   }).setView([53.9, 27.566], 7);

  //   L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  //     maxZoom: 18,
  //     minZoom: 7, 
  //     attribution: '&copy; OpenStreetMap',
  //     updateWhenZooming: false,
  //   }).addTo(this.map);

  //   this.map.createPane('mask');
  //   const maskPane = this.map.getPane('mask');
  //   if (maskPane) {
  //     maskPane.style.pointerEvents = 'none';
  //     maskPane.style.zIndex = '350';
  //   }

  //   this.markersLayer = L.markerClusterGroup({
  //     showCoverageOnHover: false,
  //     spiderfyOnMaxZoom: true,
  //     chunkedLoading: true,
  //     chunkDelay: 40,
  //     maxClusterRadius: 44,
  //     iconCreateFunction: (cluster) => this.createClusterIcon(cluster)
  //   });
  //   this.markersLayer.addTo(this.map);
  //   this.addBorders();
  // }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      preferCanvas: true,
    }).setView([53.9, 27.566], 7);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 7, 
      attribution: '&copy; OpenStreetMap',
      updateWhenZooming: false,
    }).addTo(this.map);

    this.map.createPane('mask');
    const maskPane = this.map.getPane('mask');
    if (maskPane) {
      maskPane.style.pointerEvents = 'none';
      maskPane.style.zIndex = '350';
    }

    // === ФИКС ДЛЯ ANGULAR 21 PRODUCTION СБОРКИ ===
    // Явно проверяем и вызываем конструктор через глобальный контекст или приведение к any
    const leafletInstance = L as any;
    if (typeof leafletInstance.markerClusterGroup !== 'function') {
      console.warn('MarkerClusterGroup не найден в объекте L, пробуем альтернативную инициализацию');
    }

    this.markersLayer = leafletInstance.markerClusterGroup({
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      chunkedLoading: true,
      chunkDelay: 40,
      maxClusterRadius: 44,
      iconCreateFunction: (cluster: any) => this.createClusterIcon(cluster)
    });
    // =============================================

    this.markersLayer.addTo(this.map);
    this.addBorders();
  }

  private addBorders(): void {
    this.http.get('assets/data/by_borders_lvl0.json').subscribe((geoJson: any) => {
      this.maskLayer?.remove();
      this.bordersLayer?.remove();

      const belarusOnly = L.geoJSON(geoJson, {
        interactive: false
      });
      const bounds = belarusOnly.getBounds();
      
      // this.map?.fitBounds(bounds);
      this.map?.setMaxBounds(bounds.pad(0.1)); 

      const worldRing: [number, number][] = [
        [-180, -90],
        [180, -90],
        [180, 90],
        [-180, 90],
        [-180, -90]
      ];

      const holes: any[] = [];
      const feature = geoJson.features?.[0];
      const type = feature?.geometry?.type;
      const coords = feature?.geometry?.coordinates;

      if (type === 'Polygon' && Array.isArray(coords)) {
        coords.forEach((ring: any) => holes.push(ring));
      } else if (type === 'MultiPolygon' && Array.isArray(coords)) {
        coords.forEach((polygon: any) => polygon.forEach((ring: any) => holes.push(ring)));
      }

      const invertedMask = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: [worldRing, ...holes]
        }
      };

      const maskRenderer = L.canvas({ padding: 0.4 });
      const maskOptions: any = {
        pane: 'mask',
        interactive: false,
        renderer: maskRenderer,
        style: {
          color: 'transparent',
          weight: 0,
          fillColor: '#ffffff',
          fillOpacity: 0.9,
          fillRule: 'evenodd',
          className: 'by-mask'
        }
      };

      const bordersOptions: any = {
        pane: 'mask',
        interactive: false,
        renderer: maskRenderer,
        style: {
          color: '#2f6b3f',
          weight: 2,
          opacity: 0.9,
          fillOpacity: 0
        }
      };

      this.maskLayer = L.geoJSON(invertedMask as any, maskOptions).addTo(this.map!);
      this.bordersLayer = L.geoJSON(geoJson, bordersOptions).addTo(this.map!);
    });
  }

  private renderMarkers(): void {
    if (!this.markersLayer) {
      return;
    }
    this.markersLayer.clearLayers();
    this.markerById.clear();

    this.filteredWomen.forEach((woman) => {
      this.ensureDetailsLoaded(woman.id);

      const marker = L.marker(woman.coordinates, {
        icon: this.createMarkerIcon(woman, this.getMarkerPhotoSrc(woman)),
        riseOnHover: true,
        title: woman.name
      });

      marker.bindTooltip(this.createTooltipHtml(woman), {
        permanent: false,
        sticky: true,
        direction: 'top',
        offset: [0, -16],
        opacity: 1,
        className: 'woman-tooltip-leaflet'
      });

      marker.on('click', () => {
        this.zone.run(() => {
          this.suppressOutsideClick = true;
          window.setTimeout(() => {
            this.suppressOutsideClick = false;
          }, 0);
          this.selectedWoman = woman;
          this.isPreviewOpen = true;
          this.isFiltersOpen = false;
          this.activeImageIndex = 0;
          this.cdr.markForCheck();
          this.deferResize();
        });
      });

      this.markerById.set(woman.id, marker);
      marker.addTo(this.markersLayer!);
    });
  }

 private createMarkerIcon(woman: WomanProfile, src: string): L.DivIcon {
  const safeSrc = this.escapeHtml(src);
  const safeName = this.escapeHtml(woman.name);
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 48px;
        height: 48px;
        border-radius: 50%;
        overflow: hidden;
        border: 2.5px solid rgba(255,255,255,0.9);
        box-shadow: 0 4px 12px rgba(0,0,0,0.22), 0 0 0 3px rgba(100,140,255,0.22);
        background: #ccc;
        flex-shrink: 0;
      ">
        <img
          src="${safeSrc}"
          alt="${safeName}"
          loading="lazy"
          onerror="this.src='assets/stockWoman.webp'"
          style="
            width: 48px;
            height: 48px;
            object-fit: cover;
            display: block;
            border-radius: 0;
          "
        />
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });
}

  private createClusterIcon(cluster: any): L.DivIcon {
  const count = cluster.getChildCount();
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width: 54px;
        height: 54px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.72) 60%, rgba(255,255,255,0.6) 100%);
        border: 1.5px solid rgba(47,107,63,0.4);
        box-shadow: 0 20px 36px rgba(0,0,0,0.18), 0 0 0 4px rgba(47,107,63,0.18);
        font-weight: 900;
        font-size: 14px;
        color: #1b4d2a;
        font-family: inherit;
      ">
        ${count}
      </div>
    `,
    iconSize: [54, 54],
    iconAnchor: [27, 27]
  });
}

  private deferResize(): void {
    if (!this.map) {
      return;
    }

    if (this.timerId) {
      window.clearTimeout(this.timerId);
    }

    this.timerId = window.setTimeout(() => {
      this.map?.invalidateSize();
    }, 250);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.suppressOutsideClick) {
      return;
    }

    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    if (this.isFiltersOpen && !this.isClickInside(target, this.filtersPanel, this.filtersToggle)) {
      this.closeFilters();
      this.cdr.markForCheck();
    }

    if (this.isPreviewOpen && !this.isClickInside(target, this.previewPanel)) {
      this.closePreview();
      this.cdr.markForCheck();
    }
  }

  private isClickInside(target: Node, ...refs: Array<ElementRef<HTMLElement> | undefined>): boolean {
    return refs.some((ref) => !!ref?.nativeElement && ref.nativeElement.contains(target));
  }

  trackById(_: number, item: WomanProfile): string {
    return item.id;
  }

  trackByImage(index: number): number {
    return index;
  }

  prevImage(total: number): void {
    if (total <= 1) {
      return;
    }
    this.activeImageIndex = (this.activeImageIndex - 1 + total) % total;
  }

  nextImage(total: number): void {
    if (total <= 1) {
      return;
    }
    this.activeImageIndex = (this.activeImageIndex + 1) % total;
  }

  setImageIndex(index: number): void {
    this.activeImageIndex = index;
  }

  private matchesTimeline(woman: WomanProfile): boolean {
    if (this.isAllTime) {
      return true;
    }

    const [start, end] = this.getCenturyBounds(this.selectedCentury);

    const birth = woman.birth;
    const death = woman.death;

    if (birth == null && death == null) {
      return true;
    }

    if (birth != null && death == null) {
      return birth >= start && birth <= end;
    }

    if (birth == null && death != null) {
      return death >= start && death <= end;
    }

    const lifeStart = Math.min(birth!, death!);
    const lifeEnd = Math.max(birth!, death!);
    return lifeStart <= end && lifeEnd >= start;
  }

  private getCenturyBounds(century: number): [number, number] {
    // X век -> 901–1000, XI век -> 1001–1100, ... XXI век -> 2001–2100
    const start = (century - 1) * 100 + 1;
    const end = century * 100;
    return [start, end];
  }

  toRomanCentury(century: number): string {
    const map: Record<number, string> = {
      10: 'X',
      11: 'XI',
      12: 'XII',
      13: 'XIII',
      14: 'XIV',
      15: 'XV',
      16: 'XVI',
      17: 'XVII',
      18: 'XVIII',
      19: 'XIX',
      20: 'XX',
      21: 'XXI'
    };
    return map[century] ?? `${century}`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private ensureDetailsLoaded(id: string): void {
    if (this.detailsCache.has(id) || this.detailsRequested.has(id)) {
      return;
    }

    this.detailsRequested.add(id);
    this.mapData.getDetailsById(id).subscribe((details) => {
      if (!details) {
        return;
      }
      this.detailsCache.set(id, details);
      this.updateMarkerVisuals(id);
    });
  }

  private updateMarkerVisuals(id: string): void {
    const marker = this.markerById.get(id);
    const woman = this.filteredWomen.find((w) => w.id === id);
    if (!marker || !woman) {
      return;
    }

    marker.setIcon(this.createMarkerIcon(woman, this.getMarkerPhotoSrc(woman)));
    marker.setTooltipContent(this.createTooltipHtml(woman));
  }

  centuryTicks = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

  getTickPercent(c: number): number {
    const range = this.timelineMax - this.timelineMin;
    return ((c - this.timelineMin) / range) * 100;
  }

  get thumbPercent(): number {
    const range = this.timelineMax - this.timelineMin;
    return ((this.selectedCentury - this.timelineMin) / range) * 100;
  }

  private getMarkerPhotoSrc(woman: WomanProfile): string {
    const details = this.detailsCache.get(woman.id);
    const candidate =
      details?.heroImage ??
      woman.images?.[0] ??
      'assets/stockWoman.webp';
    return candidate || 'assets/stockWoman.webp';
  }

  private createTooltipHtml(woman: WomanProfile): string {
    const src = this.getMarkerPhotoSrc(woman);
    const safeName = this.escapeHtml(woman.name);
    return `
      <div style="
      display: flex;
      gap: 10px;
      align-items: center;
      padding: 10px 12px;
      border-radius: 16px;
      background: rgba(245,248,245,0.96);
      border: 1px solid rgba(47,107,63,0.16);
      box-shadow: 0 18px 45px rgba(27,36,27,0.18);
      backdrop-filter: blur(14px);
      max-width: min(280px, 70vw);
      font-family: inherit;
    ">
      <img
        src="${src}"
        alt=""
        loading="lazy"
        style="
          width: 42px;
          height: 42px;
          border-radius: 50%;
          object-fit: cover;
          flex-shrink: 0;
          box-shadow: 0 10px 18px rgba(27,36,27,0.12);
          border: 1px solid rgba(47,107,63,0.18);
          display: block;
        "
      />
      <div style="min-width: 0; display: grid; gap: 6px;">
        <div style="
          font-weight: 900;
          color: #1b241b;
          font-size: 13px;
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        ">${safeName}</div>
        <div style="
          height: 1px;
          background: linear-gradient(90deg, rgba(47,107,63,0) 0%, rgba(47,107,63,0.55) 50%, rgba(47,107,63,0) 100%);
        "></div>
        <div style="
          font-size: 11px;
          color: 
#7a8a7a;
          font-weight: 700;
        ">Нажмите, чтобы открыть карточку</div>
      </div>
    </div>
    `;
  }

  // СВАЙПЫ ДЛЯ КАРТИНОК
  private touchStartX = 0;
  private touchEndX = 0;

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent, total: number): void {
    this.touchEndX = event.changedTouches[0].screenX;
    const diff = this.touchStartX - this.touchEndX;

    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        this.nextImage(total);
      } else {
        this.prevImage(total);
      }
    }
  }

}
