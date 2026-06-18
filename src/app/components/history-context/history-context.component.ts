import { DOCUMENT } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

type SymbolViewerKind = 'emblem' | 'flag';

type SymbolViewerState = {
  kind: SymbolViewerKind;
  src: string;
  alt: string;
  title: string;
  detailsLabel: string;
  detailsUrl: string;
};

const SYMBOL_MAP: Record<SymbolViewerKind, SymbolViewerState> = {
  emblem: {
    kind: 'emblem',
    src: 'assets/Emblem_of_Belarus.svg',
    alt: 'Герб Беларуси',
    title: 'Герб',
    detailsLabel: 'Прочитать подробнее о Гербе',
    detailsUrl: 'https://president.gov.by/ru/gosudarstvo/simvolika/gerb',
  },
  flag: { 
    kind: 'flag', 
    src: 'assets/history-context/flag2.jpg', 
    alt: 'Флаг Беларуси', 
    title: 'Флаг',
    detailsLabel: 'Прочитать подробнее о Флаге',
    detailsUrl: 'https://president.gov.by/ru/gosudarstvo/simvolika/flag',
  },
};

@Component({
  selector: 'app-history-context',
  imports: [RouterLink],
  templateUrl: './history-context.component.html',
  styleUrl: './history-context.component.scss'
})
export class HistoryContextComponent {
  private readonly document = inject(DOCUMENT);
  private readonly sanitizer = inject(DomSanitizer);

  viewer = signal<SymbolViewerState | null>(null);
  anthemOpen = signal(false);
  readonly anthemDetailsLabel = 'Прочитать подробнее о Гимне';
  readonly anthemDetailsUrl = 'https://president.gov.by/ru/gosudarstvo/simvolika/gimn';

  readonly anthemUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    `https://www.youtube.com/embed/5UIJ44t25bc?autoplay=1`,
  );

  openSymbol(kind: SymbolViewerKind): void {
    this.viewer.set(SYMBOL_MAP[kind]);
    this.lockScroll();
  }

  closeViewer(): void {
    this.viewer.set(null);
    this.unlockScroll();
  }

  openAnthem(): void {
    this.anthemOpen.set(true);
    this.lockScroll();
  }

  closeAnthem(): void {
    this.anthemOpen.set(false);
    this.unlockScroll();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.viewer()) this.closeViewer();
    else if (this.anthemOpen()) this.closeAnthem();
  }

  private lockScroll(): void {
    this.document.body.style.overflow = 'hidden';
  }

  private unlockScroll(): void {
    this.document.body.style.overflow = '';
  }
}
