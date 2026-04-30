import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
import { OnlineDataService } from './online-data.service';
import { BiographyBlock, WomanDetails, WomanProfile, WomanRecord } from '../models/woman-record.model';
export type { BiographyBlock, WomanDetails, WomanProfile, WomanRecord } from '../models/woman-record.model';

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
  private onlineDataService = inject(OnlineDataService);
  private http = inject(HttpClient);
  private readonly jsonPath = 'assets/data/women-data.json';

  private getLocalData(): Observable<DataStructure> {
    return this.http.get<DataStructure>(this.jsonPath);
  }

  getLocalWomenRecords(): Observable<WomanRecord[]> {
    return this.getLocalData().pipe(map((data) => this.mergeLocalData(data)));
  }

  getAllWomenRecords(): Observable<WomanRecord[]> {
    return this.onlineDataService.getData().pipe(
      map((data) => this.mergeLocalData(data as DataStructure)),
      switchMap((records) => records.length > 0 ? of(records) : this.getLocalWomenRecords()),
      catchError(() => this.getLocalWomenRecords())
    );
  }

  // Получить только список профилей
  getAllProfiles(): Observable<WomanProfile[]>{
    return this.getAllWomenRecords().pipe(map((records) => records.map((record) => this.toProfile(record))));
  }

  getProfileById(id: string): Observable<WomanProfile | undefined> {
    return this.getAllProfiles().pipe(
      map(profiles => profiles.find(p => p.id === id))
    );
  }

  getDetailsById(id: string): Observable<WomanDetails | undefined> {
    return this.getAllWomenRecords().pipe(
      map((records) => records.find((record) => record.id === id)),
      map((record) => record ? this.toDetails(record) : undefined)
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
    return ['XII век', 'XVIII век', 'XIX век', 'XX век', 'XXI век'];
  }

  private mergeLocalData(data: DataStructure): WomanRecord[] {
    return data.profiles.map((profile) => {
      const details = data.details.find((item) => item.id === profile.id);
      return {
        ...profile,
        heroImage: details?.heroImage || profile.images[0] || 'assets/stockWoman.webp',
        previewImages: details?.previewImages || profile.images,
        fullBiography: details?.fullBiography || []
      };
    });
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
      fullBiography: record.fullBiography as BiographyBlock[]
    };
  }
}
