import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FadeInOnScrollDirective } from '../../directives/fade-in-on-scroll.directive';

type SymbolViewerKind = 'emblem' | 'flag';
type SymbolViewerState = {
  kind: SymbolViewerKind;
  src: string;
  alt: string;
  title: string;
};

@Component({
  selector: 'app-history-context',
  imports: [RouterLink, FadeInOnScrollDirective],
  templateUrl: './history-context.component.html',
  styleUrl: './history-context.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HistoryContextComponent {
  private readonly document = inject(DOCUMENT);
  viewer: SymbolViewerState | null = null;

  openSymbol(kind: SymbolViewerKind): void {
    this.viewer = kind === 'emblem'
      ? { kind, src: 'assets/Emblem_of_Belarus.svg', alt: 'Герб Беларуси', title: 'Герб' }
      : { kind, src: 'assets/Flag_of_Belarus.svg', alt: 'Флаг Беларуси', title: 'Флаг' };
    this.document.body.style.overflow = 'hidden';
  }

  closeViewer(): void {
    this.viewer = null;
    this.document.body.style.overflow = '';
  }

  openAnthem(): void {
    window.open('https://www.youtube.com/watch?v=5UIJ44t25bc', '_blank', 'noopener,noreferrer');
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.viewer) {
      this.closeViewer();
    }
  }
}