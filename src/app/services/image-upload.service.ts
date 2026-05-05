import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

interface ImgBbUploadResponse {
  data?: {
    url?: string;
  };
  error?: {
    message?: string;
  };
  success?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ImageUploadService {
  private readonly http = inject(HttpClient);
  private readonly apiKey = environment.imgbbApiKey;

  uploadImage(file: File): Observable<string> {
    if (!this.apiKey || this.apiKey === 'YOUR_IMGBB_API_KEY') {
      return throwError(() => new Error('Не настроен API-ключ ImgBB. Укажите его в environment.'));
    }

    const formData = new FormData();
    formData.append('image', file);

    return this.http
      .post<ImgBbUploadResponse>(`https://api.imgbb.com/1/upload?key=${this.apiKey}`, formData)
      .pipe(
        map((response) => {
          const imageUrl = response.data?.url?.trim();

          if (!imageUrl) {
            throw new Error(response.error?.message || 'Сервис ImgBB не вернул ссылку на изображение.');
          }

          return imageUrl;
        })
      );
  }
}
