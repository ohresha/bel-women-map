import { NgFor, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BiographyBlock, MapDataService, WomanDetails, WomanProfile } from '../../services/map-data.service';
import { FadeInOnScrollDirective } from '../../directives/fade-in-on-scroll.directive';

@Component({
  selector: 'app-woman-detail',
  imports: [NgIf, NgFor, RouterLink, FadeInOnScrollDirective],
  templateUrl: './woman-detail.component.html',
  styleUrl: './woman-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WomanDetailComponent implements OnDestroy {
  profile?: WomanProfile;
  details?: WomanDetails;
  lightboxImage?: string;

  private routeSub?: Subscription;

  constructor( private readonly route: ActivatedRoute, private readonly mapData: MapDataService, private readonly cdr: ChangeDetectorRef ) {
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id') ?? '';
      
      this.mapData.getProfileById(id).subscribe(profile => {
        this.profile = profile;
        this.cdr.markForCheck();
      });
      this.mapData.getDetailsById(id).subscribe(details => {
        this.details = details;
        this.cdr.markForCheck();
      });
      this.lightboxImage = undefined;
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
