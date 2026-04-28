import {
  AfterViewInit,
  ChangeDetectorRef,
  Directive,
  ElementRef,
  HostBinding,
  NgZone,
} from '@angular/core';

@Directive({
  selector: '[fadeInOnScroll]',
  standalone: true,
})
export class FadeInOnScrollDirective implements AfterViewInit {
  @HostBinding('class.is-visible') isVisible = false;

  constructor(
    private readonly zone: NgZone,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      setTimeout(() => {
        this.zone.run(() => {
          this.isVisible = true;
          this.cdr.markForCheck();
        });
      }, 0);
    });
  }
}