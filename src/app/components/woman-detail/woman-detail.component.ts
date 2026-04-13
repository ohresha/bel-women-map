import { NgFor, NgIf, NgSwitch, NgSwitchCase } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, Directive, ElementRef, HostBinding, HostListener, NgZone, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BiographyBlock, MapDataService, WomanDetails, WomanProfile } from '../../services/map-data.service';

@Directive({
  selector: '[fadeInOnScroll]',
  standalone: true
})
export class FadeInOnScrollDirective implements AfterViewInit, OnDestroy {
  @HostBinding('class.is-visible') isVisible = false;
  private observer?: IntersectionObserver;

  constructor(
    private readonly elementRef: ElementRef<HTMLElement>,
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef  // ← добавьте
  ) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.zone.run(() => {
                this.isVisible = true;
                this.cdr.markForCheck(); // ← добавьте
              });
              this.observer?.disconnect();
            }
          });
        },
        { threshold: 0.15 }
      );
      this.observer.observe(this.elementRef.nativeElement);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}

@Component({
  selector: 'app-woman-detail',
  imports: [NgIf, NgFor, NgSwitch, NgSwitchCase, RouterLink, FadeInOnScrollDirective],
  templateUrl: './woman-detail.component.html',
  styleUrl: './woman-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WomanDetailComponent implements OnDestroy {
  profile?: WomanProfile;
  details?: WomanDetails;
  lightboxImage?: string;

  private routeSub?: Subscription;

  constructor(
  private readonly route: ActivatedRoute,
  private readonly mapData: MapDataService,
  private readonly cdr: ChangeDetectorRef
) {
  this.routeSub = this.route.paramMap.subscribe((params) => {
    const id = params.get('id') ?? '';
    this.profile = this.mapData.getById(id);
    this.details = this.mapData.getDetailsById(id);
    this.lightboxImage = undefined;
    this.cdr.markForCheck(); // ← добавьте
  });
}

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
  }

  openLightbox(image: string): void {
    this.lightboxImage = image;
  }

  closeLightbox(): void {
    this.lightboxImage = undefined;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.lightboxImage) {
      this.closeLightbox();
    }
  }

  trackByBlock(index: number, block: BiographyBlock): string {
    return `${block.type}-${index}`;
  }

  trackByImage(index: number, image: string): string {
    return `${image}-${index}`;
  }
}
