import { Injectable } from '@angular/core';

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

export interface MapFilters {
  search: string;
  regions: string[];
  categories: string[];
  centuries: string[];
}

@Injectable({
  providedIn: 'root'
})
export class MapDataService {
  private readonly data: WomanProfile[] = [
    {
      id: 'kharujaya',
      name: 'Вера Хоружая',
      birth: 1903,
      death: 1942,
      region: 'Витебская область',
      city: 'Лондон',
      categories: ['Просвещение', 'Общественная деятельность', 'Общественная деятельность', 'Общественная деятельность'],
      century: 'XX век',
      shortInfo: 'Участница подпольного движения, известная своей деятельностью в годы войны.',
      coordinates: [55.197, 30.204],
      images: [
        'assets/homepage_women/vera_kharujaya.jpg'
      ]
    },
    {
      id: 'stanuta',
      name: 'Стефания Станюта',
      birth: 1905,
      death: 2000,
      region: 'Минская область',
      city: 'Лондон',
      categories: ['Культура', 'Искусство'],
      century: 'XX век',
      shortInfo: 'Актриса театра и кино, одна из легенд белорусской сцены.',
      coordinates: [53.902, 27.561],
      images: [
        'assets/homepage_women/steph_stanuta.jpg'
      ]
    },
    {
      id: 'domracheva',
      name: 'Дарья Домрачева',
      birth: 1986,
      region: 'Минская область',
      city: 'Лондон',
      categories: ['Спорт'],
      century: 'XXI век',
      shortInfo: 'Олимпийская чемпионка по биатлону, вдохновляющий пример современной Беларуси.',
      coordinates: [53.9, 27.566],
      images: [
        'assets/homepage_women/daria_domracheva.png',
        'assets/homepage_women/daria_domracheva.png',
      ]
    },
    {
      id: 'chikalova',
      name: 'Ирина Чикалова',
      birth: 1961,
      region: 'Гомельская область',
      city: 'Лондон',
      categories: ['Спорт', 'Просвещение'],
      century: 'XX век',
      shortInfo: 'Бегунья на длинные дистанции, популяризатор спорта и здорового образа жизни.',
      coordinates: [52.441, 30.987],
      images: [
        'assets/homepage_women/irina_chikalova.jpg'
      ]
    },
    {
      id: 'aleksandrauskaja',
      name: 'Лариса Александраускас',
      birth: 1947,
      region: 'Брестская область',
      city: 'Лондон',
      categories: ['Наука', 'Просвещение'],
      century: 'XX век',
      shortInfo: 'Исследователь и педагог, внесшая вклад в развитие образования региона.',
      coordinates: [52.093, 23.685],
      images: [
        'assets/homepage_women/larisa_aleksandrauskaja.jpg'
      ]
    }
  ];

  getAll(): WomanProfile[] {
    return [...this.data];
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

  filter(filters: MapFilters): WomanProfile[] {
    const searchLower = filters.search.trim().toLowerCase();
    return this.data.filter((woman) => {
      const matchesSearch =
        searchLower.length === 0 ||
        woman.name.toLowerCase().includes(searchLower);

      const matchesRegion =
        filters.regions.length === 0 ||
        filters.regions.includes(woman.region);

      const matchesCategories =
        filters.categories.length === 0 ||
        filters.categories.some((category) => woman.categories.includes(category));

      const matchesCentury =
        filters.centuries.length === 0 ||
        filters.centuries.includes(woman.century);

      return matchesSearch && matchesRegion && matchesCategories && matchesCentury;
    });
  }
}
