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

export interface WomanDetails {
  id: string;
  heroImage: string;
  previewImages: string[];
  fullBiography: BiographyBlock[];
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

  private readonly details: WomanDetails[] = [
    {
      id: 'kharujaya',
      heroImage: 'assets/homepage_women/vera_kharujaya.jpg',
      previewImages: [
        'assets/homepage_women/vera_kharujaya.jpg'
      ],
      fullBiography: [
        {
          type: 'text',
          title: 'Детство и образование',
          text:
            'Вера Хоружая росла в атмосфере стремления к знаниям и ответственности. Ранние годы сформировали в ней сильный характер, который позже проявился в общественной и подпольной работе.'
        },
        {
          type: 'quote',
          text: 'Сила человека измеряется тем, насколько он верен своим идеалам в самые трудные времена.',
          author: 'Из воспоминаний современников'
        },
        {
          type: 'text',
          title: 'Общественная деятельность',
          text:
            'Хоружая активно участвовала в подпольном движении и была известна своей стойкостью. Ее деятельность стала символом сопротивления и гражданской смелости.'
        },
        {
          type: 'image-gallery',
          title: 'Исторические материалы',
          images: [
            {
              src: 'assets/homepage_women/vera_kharujaya.jpg',
              caption: 'Архивный портрет'
            }
          ]
        }
      ]
    },
    {
      id: 'stanuta',
      heroImage: 'assets/homepage_women/steph_stanuta.jpg',
      previewImages: [
        'assets/homepage_women/steph_stanuta.jpg'
      ],
      fullBiography: [
        {
          type: 'text',
          title: 'Ранние годы',
          text:
            'Стефания Станюта рано проявила интерес к театру. Ее артистический путь начался с небольших ролей и постепенно привел к признанию на национальной сцене.'
        },
        {
          type: 'quote',
          text: 'Сцена — это место, где правда звучит громче всего.',
          author: 'Стефания Станюта'
        },
        {
          type: 'text',
          title: 'Творческий путь',
          text:
            'Ее роли отличались глубиной и психологической точностью. Станюта стала одной из ключевых фигур белорусского театра.'
        },
        {
          type: 'image-gallery',
          title: 'Фотографии постановок',
          images: [
            {
              src: 'assets/homepage_women/steph_stanuta.jpg',
              caption: 'Сцена из спектакля'
            }
          ]
        }
      ]
    },
    {
      id: 'domracheva',
      heroImage: 'assets/homepage_women/daria_domracheva.png',
      previewImages: [
        'assets/homepage_women/daria_domracheva.png',
        'assets/homepage_women/daria_domracheva.png'
      ],
      fullBiography: [
        {
          type: 'text',
          title: 'Начало спортивной карьеры',
          text:
            'Дарья Домрачева пришла в биатлон с дисциплиной и упорством. Ее ранние результаты быстро привлекли внимание тренеров и болельщиков.'
        },
        {
          type: 'quote',
          text: 'Победа — это сумма маленьких ежедневных усилий.',
          author: 'Дарья Домрачева'
        },
        {
          type: 'text',
          title: 'Олимпийские достижения',
          text:
            'Олимпийские медали Домрачевой стали символом современной спортивной Беларуси. Ее выступления вдохновили новое поколение атлетов.'
        },
        {
          type: 'image-gallery',
          title: 'Спортивные моменты',
          images: [
            {
              src: 'assets/homepage_women/daria_domracheva.png',
              caption: 'Олимпийский пьедестал'
            }
          ]
        }
      ]
    },
    {
      id: 'chikalova',
      heroImage: 'assets/homepage_women/irina_chikalova.jpg',
      previewImages: [
        'assets/homepage_women/irina_chikalova.jpg'
      ],
      fullBiography: [
        {
          type: 'text',
          title: 'Спортивная база',
          text:
            'Ирина Чикалова прославилась как спортсменка, умеющая сочетать выносливость и стратегию. Ее тренировки всегда были примером дисциплины.'
        },
        {
          type: 'quote',
          text: 'Бег — это диалог с собой и со временем.',
          author: 'Ирина Чикалова'
        },
        {
          type: 'text',
          title: 'Просветительская роль',
          text:
            'После активной спортивной карьеры она посвятила себя популяризации здорового образа жизни и поддержке молодых спортсменов.'
        },
        {
          type: 'image-gallery',
          title: 'Марафонские трассы',
          images: [
            {
              src: 'assets/homepage_women/irina_chikalova.jpg',
              caption: 'На дистанции'
            }
          ]
        }
      ]
    },
    {
      id: 'aleksandrauskaja',
      heroImage: 'assets/homepage_women/larisa_aleksandrauskaja.jpg',
      previewImages: [
        'assets/homepage_women/larisa_aleksandrauskaja.jpg'
      ],
      fullBiography: [
        {
          type: 'text',
          title: 'Образование и наука',
          text:
            'Лариса Александраускас посвятила себя развитию образования. Ее исследования и методики стали заметным вкладом в региональную педагогическую практику.'
        },
        {
          type: 'quote',
          text: 'Настоящее просвещение начинается с уважения к личности.',
          author: 'Лариса Александраускас'
        },
        {
          type: 'text',
          title: 'Педагогическая миссия',
          text:
            'Она активно работала с молодыми специалистами, продвигая идеи современного образования и практической науки.'
        },
        {
          type: 'image-gallery',
          title: 'Архивные материалы',
          images: [
            {
              src: 'assets/homepage_women/larisa_aleksandrauskaja.jpg',
              caption: 'Портрет исследователя'
            }
          ]
        }
      ]
    }
  ];

  getAll(): WomanProfile[] {
    return [...this.data];
  }

  getById(id: string): WomanProfile | undefined {
    return this.data.find((woman) => woman.id === id);
  }

  getDetailsById(id: string): WomanDetails | undefined {
    return this.details.find((detail) => detail.id === id);
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
