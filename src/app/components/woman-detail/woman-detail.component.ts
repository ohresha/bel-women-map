import { DOCUMENT } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  QueryList,
  ViewChildren,
  inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest, switchMap } from 'rxjs';
import {
  BiographyBlock,
  MapDataService,
  WomanDetails,
  WomanProfile
} from '../../services/map-data.service';

type TextBiographyBlock    = Extract<BiographyBlock, { type: 'text' }>;
type QuoteBiographyBlock   = Extract<BiographyBlock, { type: 'quote' }>;
type GalleryBiographyBlock = Extract<BiographyBlock, { type: 'image-gallery' }>;

type TocSection = { id: string; title: string };

type GalleryItem = { src: string; caption: string };

type BiographySection = {
  id: string;
  title: string;
  text: string;
  imageSrc?: string;
  imageCaption: string;
  imageSide: 'left' | 'right';
};

type RenderBlock =
  | { type: 'section'; section: BiographySection }
  | { type: 'quote';   quote: QuoteBiographyBlock }
  | { type: 'gallery'; title?: string; images: GalleryItem[] };

@Component({
  selector: 'app-woman-detail',
  imports: [RouterLink],
  templateUrl: './woman-detail.component.html',
  styleUrl: './woman-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WomanDetailComponent implements AfterViewInit, OnDestroy {
  @ViewChildren('bioSection') private bioSections?: QueryList<ElementRef<HTMLElement>>;

  private readonly document = inject(DOCUMENT);

  profile?: WomanProfile;
  details?: WomanDetails;
  tocSections: TocSection[]  = [];
  renderBlocks: RenderBlock[] = [];
  galleryItems: GalleryItem[] = [];
  lightboxImage?: GalleryItem;
  activeSectionId?: string;
  isMobileTocOpen = false;
  showBackToTop   = false;

  private sectionObserver?: IntersectionObserver;
  private rafScrollId?: number;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly mapData: MapDataService,
    private readonly cdr: ChangeDetectorRef
  ) {
    this.route.paramMap.pipe(
      switchMap(params =>
        combineLatest([
          this.mapData.getProfileById(params.get('id') ?? ''),
          this.mapData.getDetailsById(params.get('id') ?? '')
        ])
      ),
      takeUntilDestroyed()
    ).subscribe(([profile, details]) => {
      this.profile        = profile;
      this.details        = details;
      this.lightboxImage  = undefined;
      this.isMobileTocOpen = false;
      this.buildViewModel();
      this.cdr.markForCheck();
    });
  }

  ngAfterViewInit(): void {
    this.setupSectionObserver();
    this.bioSections?.changes
      .pipe(takeUntilDestroyed())   // ← если хотите без ручного unsub
      .subscribe(() => this.setupSectionObserver());
  }

  ngOnDestroy(): void {
    this.sectionObserver?.disconnect();
    cancelAnimationFrame(this.rafScrollId ?? 0);
    this.document.body.style.overflow = '';
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    cancelAnimationFrame(this.rafScrollId ?? 0);
    this.rafScrollId = requestAnimationFrame(() => {
      const next = this.getScrollTop() > 300;
      if (next !== this.showBackToTop) {
        this.showBackToTop = next;
        this.cdr.markForCheck();
      }
    });
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.lightboxImage) this.closeLightbox();
  }

  scrollToSectionFromLink(event: Event, sectionId: string): void {
    event.preventDefault();
    this.scrollToSectionById(sectionId);
  }

  scrollToTop(): void {
    this.document.defaultView?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleMobileToc(): void { this.isMobileTocOpen = !this.isMobileTocOpen; }

  openLightbox(image: GalleryItem): void {
    this.lightboxImage = image;
    this.document.body.style.overflow = 'hidden';
  }

  closeLightbox(): void {
    this.lightboxImage = undefined;
    this.document.body.style.overflow = '';
  }

  trackByRenderBlock(_: number, block: RenderBlock): string {
    return block.type === 'section' ? block.section.id : `${block.type}-${_}`;
  }

  trackByToc(_: number, s: TocSection): string  { return s.id; }
  trackByGallery(_: number, item: GalleryItem): string { return item.src; }

  // ─── private ────────────────────────────────────────────────────────────────

  private buildViewModel(): void {
    if (!this.profile || !this.details) {
      this.tocSections    = [];
      this.renderBlocks   = [];
      this.galleryItems   = [];
      this.activeSectionId = undefined;
      this.showBackToTop  = false;
      return;
    }

    this.galleryItems  = this.buildGalleryItems();
    this.renderBlocks  = this.buildRenderBlocks();
    this.tocSections   = this.renderBlocks
      .filter((b): b is Extract<RenderBlock, { type: 'section' }> => b.type === 'section')
      .map(b => ({ id: b.section.id, title: b.section.title }));
    this.activeSectionId = this.tocSections[0]?.id;
    this.showBackToTop   = this.getScrollTop() > 300;
  }

  private buildGalleryItems(): GalleryItem[] {
    return this.details!.previewImages.map((src, i) => ({
      src,
      caption: `Фотография ${i + 1}. ${this.profile!.name}`
    }));
  }

  private buildRenderBlocks(): RenderBlock[] {
    const usedIds = new Set<string>();
    let textIndex = 0;

    return this.details!.fullBiography.map((block, i) => {
      if (block.type === 'text') {
        return { type: 'section', section: this.buildSection(block, i, usedIds, textIndex++) };
      }
      if (block.type === 'image-gallery') {
        return {
          type: 'gallery',
          title: block.title,
          images: (block as GalleryBiographyBlock).images.map((img, gi) => ({
            src: img.src,
            caption: img.caption || `Фотография ${gi + 1}. ${this.profile!.name}`
          }))
        };
      }
      return { type: 'quote', quote: block as QuoteBiographyBlock };
    });
  }

  private buildSection(
    block: TextBiographyBlock,
    index: number,
    usedIds: Set<string>,
    textIndex: number
  ): BiographySection {
    return {
      id:           this.createSectionId(block.title, index, usedIds),
      title:        block.title,
      text:         block.text,
      imageSrc:     block.image?.trim() || undefined,
      imageCaption: `Иллюстрация к разделу «${block.title}»`,
      imageSide:    this.resolveImageSide(block, textIndex)
    };
  }

  private resolveImageSide(block: TextBiographyBlock, textIndex: number): 'left' | 'right' {
    if (block.imageSide === 'left' || block.imageSide === 'right') return block.imageSide;
    return textIndex % 2 === 0 ? 'right' : 'left';
  }

  private setupSectionObserver(): void {
    this.sectionObserver?.disconnect();

    const elements = this.bioSections?.toArray().map(r => r.nativeElement) ?? [];
    if (!elements.length) return;

    this.sectionObserver = new IntersectionObserver(entries => {
      const top = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      const nextId = top?.target.getAttribute('id') ?? this.activeSectionId;
      if (nextId && nextId !== this.activeSectionId) {
        this.activeSectionId = nextId;
        this.cdr.markForCheck();
      }
    }, { rootMargin: '-20% 0px -50% 0px', threshold: [0.2, 0.45, 0.65] });

    elements.forEach(el => this.sectionObserver!.observe(el));
  }

  private scrollToSectionById(id: string): void {
    const target = this.document.getElementById(id);
    if (!target) return;

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.activeSectionId = id;
    this.isMobileTocOpen = false;
    this.document.defaultView?.history.replaceState(null, '', `#${id}`);
    this.cdr.markForCheck();
  }

  private createSectionId(title: string, index: number, usedIds: Set<string>): string {
    const base = title
      .toLowerCase()
      .replace(/[^a-zа-яё0-9]+/gi, '-')
      .replace(/^-+|-+$/g, '')
      || `section-${index + 1}`;

    let candidate = base;
    let n = 2;
    while (usedIds.has(candidate)) candidate = `${base}-${n++}`;
    usedIds.add(candidate);
    return candidate;
  }

  private getScrollTop(): number {
    return this.document.defaultView?.scrollY
      ?? this.document.documentElement.scrollTop
      ?? 0;
  }
}
