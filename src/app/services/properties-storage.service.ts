import { Injectable, isDevMode } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class PropertiesStorageService {

    getValueOfLocalStorageByKey(key: string): boolean {

        isDevMode() && console.warn('Getting value of local storage by key: ' + key);

        if (typeof localStorage === 'undefined') {
            return false;
        }

        const storedValue = localStorage.getItem(key);

        isDevMode() && console.warn('Value of local storage by key: ' + key + ' is: ' + storedValue);

        if (storedValue === null) {
            return false;
        }

        return storedValue === 'true';
    }

    setValueOfLocalStorageByKey(key: string, value: boolean): void {

        isDevMode() && console.warn('Setting value of local storage by key: ' + key + ' to: ' + value);

        if (value === null || value === undefined) {
            return;
        }

        if (typeof localStorage === 'undefined') {
            return;
        }

        localStorage.setItem(key, JSON.stringify(value));
    }


}

