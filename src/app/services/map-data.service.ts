import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { OnlineDataService } from './online-data.service';

// короткая информация для метки
export interface WomanProfile {
  id: string;
  name: string;
  birth?: number;
  death?: number;
  region: string;
  city: string;
  categories: string[];
  century: string;
  shortInfo: string;
  coordinates: [number, number];
  images: string[];
}

// части для полной информации
export interface WomanDetails {
  id: string;
  heroImage: string;
  previewImages: string[];
  fullBiography: BiographyBlock[];
}
// блоки текста и фото для полной информации
export type BiographyBlock =
  | {
      type: 'text';
      title: string;
      text: string;
    }
  | {
      type: 'quote';
      text: string;
      author?: string;
    }
  | {
      type: 'image-gallery';
      title?: string;
      images: Array<{
        src: string;
        caption?: string;
      }>;
    };

// фильтры
export interface MapFilters {
  regions: string[];
  categories: string[];
  centuries: string[];
}

interface DataStructure {
  profiles: WomanProfile[];
  details: WomanDetails[];
}

@Injectable({
  providedIn: 'root'
})
export class MapDataService {
  private onlineService = inject(OnlineDataService);

  private http = inject(HttpClient);
  private readonly jsonPath = 'assets/data/women-data.json';

  // Получить всё содержимое файла
  private getData(): Observable<DataStructure> {
    return this.http.get<DataStructure>(this.jsonPath);
  }

  // Получить только список профилей
  getAllProfiles(): Observable<WomanProfile[]>{
    return this.getData().pipe(map(d => d.profiles));
  }

  // ОНЛАЙН ВЕРСИЯ
  // getAllProfiles(): Observable<WomanProfile[]>{
  //   return this.onlineService.getData().pipe(map(d => d.profiles));
  // }

  getProfileById(id: string): Observable<WomanProfile | undefined> {
    return this.getAllProfiles().pipe(
      map(profiles => profiles.find(p => p.id === id))
    );
  }

  getDetailsById(id: string): Observable<WomanDetails | undefined> {
    return this.getData().pipe(
      map(d => d.details.find(detail => detail.id === id))
    );
  }

  filter(filters: MapFilters): Observable<WomanProfile[]>{
    return this.getAllProfiles().pipe(
      map(profiles => {
        return profiles.filter(woman => {
          const matchesRegion = filters.regions.length === 0 || filters.regions.includes(woman.region);
          const matchesCategories = filters.categories.length === 0 || filters.categories.some(cat => woman.categories.includes(cat));
          const matchesCentury = filters.centuries.length === 0 || filters.centuries.includes(woman.century);

          return matchesRegion && matchesCategories && matchesCentury;
        });
      })
    );
  }

  getRegions(): string[] {
    return [
      'Минская область',
      'Гомельская область',
      'Брестская область',
      'Витебская область',
      'Гродненская область',
      'Могилевская область'
    ];
  }

  getCategories(): string[] {
    return [
      'Наука',
      'Культура',
      'Искусство',
      'Спорт',
      'Просвещение',
      'Общественная деятельность'
    ];
  }

  getCenturies(): string[] {
    return ['XIX век', 'XX век', 'XXI век'];
  }
}

