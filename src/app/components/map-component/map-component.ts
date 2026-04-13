import { NgFor, NgIf } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import * as L from 'leaflet';
import { MapDataService, MapFilters, WomanProfile } from '../../services/map-data.service';

@Component({
  selector: 'app-map-component',
  imports: [FormsModule, NgFor, NgIf, RouterLink],
  templateUrl: './map-component.html',
  styleUrl: './map-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class MapComponent implements AfterViewInit, OnDestroy {
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;
  
  private map?: L.Map;
  private markersLayer = L.layerGroup();
  private timerId?: number;

  regions: any;
  categories: any;
  centuries: any;

  constructor(
    private readonly mapData: MapDataService,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.regions = this.mapData.getRegions();
    this.categories = this.mapData.getCategories();
    this.centuries = this.mapData.getCenturies();
  }

  filters: MapFilters = {
    search: '',
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
    this.filteredWomen = this.mapData.filter(this.filters);
    if (this.selectedWoman && !this.filteredWomen.find((item) => item.id === this.selectedWoman?.id)) {
      this.selectedWoman = undefined;
      this.isPreviewOpen = false;
      this.activeImageIndex = 0;
    }
    this.renderMarkers();
  }

  private initMap(): void {
    this.map = L.map(this.mapContainer.nativeElement, {
      // dragging: false,
      zoomControl: true
    }).setView([53.9, 27.566], 7);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 6, 
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.map);

    this.markersLayer.addTo(this.map);
  }

  private renderMarkers(): void {
    this.markersLayer.clearLayers();

    this.filteredWomen.forEach((woman) => {
      const marker = L.marker(woman.coordinates, {
        icon: this.createMarkerIcon()
      });

      marker.on('click', () => {
        this.zone.run(() => {
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
}
