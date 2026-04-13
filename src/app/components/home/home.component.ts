import { Component, OnDestroy, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  images = [
    { id: 1, src: 'assets/homepage_women/vera_kharujaya.jpg', alt: 'Вера Хоружая' },
    { id: 2, src: 'assets/homepage_women/larisa_aleksandrauskaja.jpg', alt: 'Лариса Александраускaя' },
    { id: 3, src: 'assets/homepage_women/steph_stanuta.jpg', alt: 'Стефания Станюта' },
    { id: 4, src: 'assets/homepage_women/irina_chikalova.jpg', alt: 'Ирина Чикалова' },
    { id: 5, src: 'assets/homepage_women/daria_domracheva.png', alt: 'Дарья Домрачева' }
  ];
}
