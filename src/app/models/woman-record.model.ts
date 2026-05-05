export interface WomanProfile {
  id: string;
  name: string;
  birth: number;
  death: number | null;
  region: string;
  city: string;
  categories: string[];
  century: string;
  shortInfo: string;
  coordinates: [number, number];
  images: string[];
}

export type BiographyTextBlock = {
  type: 'text';
  title: string;
  text: string;
  image?: string;
  imageSide?: 'left' | 'right';
};

export type BiographyQuoteBlock = {
  type: 'quote';
  text: string;
  author?: string;
};

export type BiographyGalleryBlock = {
  type: 'image-gallery';
  title?: string;
  images: Array<{
    src: string;
    caption: string;
  }>;
};

export type BiographyBlock =
  | BiographyTextBlock
  | BiographyQuoteBlock
  | BiographyGalleryBlock;

export interface WomanDetails {
  id: string;
  heroImage: string;
  previewImages: string[];
  fullBiography: BiographyBlock[];
}

export interface WomanRecord extends WomanProfile {
  heroImage: string;
  previewImages: string[];
  fullBiography: BiographyBlock[];
}
