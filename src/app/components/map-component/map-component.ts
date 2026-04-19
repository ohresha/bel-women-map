import { NgFor, NgIf } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, NgZone, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { MapDataService, MapFilters, WomanProfile } from '../../services/map-data.service';
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
  private markersLayer = L.layerGroup();
  private timerId?: number;
  private suppressOutsideClick = false;

  regions: any;
  categories: any;
  centuries: any;

  constructor( private readonly mapData: MapDataService, private readonly zone: NgZone, private readonly cdr: ChangeDetectorRef, private http: HttpClient ) {
    this.regions = this.mapData.getRegions();
    this.categories = this.mapData.getCategories();
    this.centuries = this.mapData.getCenturies();
  }

  filters: MapFilters = {
    regions: [],
    categories: [],
    centuries: []
  };

  filteredWomen: WomanProfile[] = [];
  selectedWoman?: WomanProfile;
  isFiltersOpen = false;
  isPreviewOpen = false;
  activeImageIndex = 0;

  ngAfterViewInit(): void {
    this.isFiltersOpen = !window.matchMedia('(max-width: 900px)').matches;
    this.cdr.markForCheck();
    this.initMap();
    this.applyFilters();
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

  toggleRegion(region: string): void {
    this.toggleValue(this.filters.regions, region);
    this.applyFilters();
  }

  toggleCategory(category: string): void {
    this.toggleValue(this.filters.categories, category);
    this.applyFilters();
  }

  toggleCentury(century: string): void {
    this.toggleValue(this.filters.centuries, century);
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
    this.mapData.filter(this.filters).subscribe((data: WomanProfile[]) => {
      this.filteredWomen = data;
      if (this.selectedWoman && !this.filteredWomen.find((item) => item.id === this.selectedWoman?.id)) {
        this.selectedWoman = undefined;
        this.isPreviewOpen = false;
        this.activeImageIndex = 0;
      }
    this.renderMarkers();
    });
  }

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

    this.markersLayer.addTo(this.map);
    this.addBorders();
  }

  private addBorders(): void {
    const worldCoords = [
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, 90],
      [-180, -90]
    ];

    this.http.get('assets/data/by_borders_lvl0.json').subscribe((geoJson: any) => {
      const feature = geoJson.features[0];
      const type = feature.geometry.type;
      const coords = feature.geometry.coordinates;

      let maskCoordinates: any[] = [worldCoords];

      if (type === 'Polygon') {
        coords.forEach((ring: any) => maskCoordinates.push(ring));
      } else if (type === 'MultiPolygon') {
        coords.forEach((polygon: any) => {
          polygon.forEach((ring: any) => maskCoordinates.push(ring));
        });
      }

      const mask = {
        "type": "Feature",
        "properties": {},
        "geometry": {
          "type": "Polygon",
          "coordinates": maskCoordinates
        }
      };

      const borderLayer = L.geoJSON(mask as any, {
        style: {
          color: '#228B22',
          weight: 3,
          fillColor: '#ffffff', 
          fillOpacity: 1,
          fillRule: 'evenodd'
        }
      }).addTo(this.map!);

      const belarusOnly = L.geoJSON(geoJson);
      const bounds = belarusOnly.getBounds();
      
      // this.map?.fitBounds(bounds);
      this.map?.setMaxBounds(bounds.pad(0.1)); 
    });
  }

  private renderMarkers(): void {
    this.markersLayer.clearLayers();

    this.filteredWomen.forEach((woman) => {
      const marker = L.marker(woman.coordinates, {
        icon: this.createMarkerIcon()
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

      marker.addTo(this.markersLayer);
    });
  }

  private createMarkerIcon(): L.DivIcon {
    return L.divIcon({
      className: 'woman-marker',
      html: '<span class="woman-marker__dot"></span>',
      iconSize: [30, 30],
      iconAnchor: [10, 10]
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
