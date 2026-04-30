export type BiographyBlock =
  | {
      type: 'text';
      title: string;
      text: string;
      image?: string | null;
      imageSide?: 'left' | 'right' | null;
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

export interface WomanDetails {
  id: string;
  heroImage: string;
  previewImages: string[];
  fullBiography: BiographyBlock[];
}

export interface WomanRecord extends WomanProfile, Omit<WomanDetails, 'id'> {}
