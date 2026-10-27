
import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class ImageFallbackService {

    private readonly fallbackImage = '/assets/no-image.svg';

    onImageError(event: Event): void {
        const img = event.target as HTMLImageElement;

        if (!img || img.tagName !== 'IMG') {
            return;
        }

        // Evitar bucles si también falla la imagen alternativa.
        img.onerror = null;
        img.src = this.fallbackImage;
    }
}
