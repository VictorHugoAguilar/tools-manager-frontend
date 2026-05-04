import { Injectable, isDevMode } from '@angular/core';

/**
 * A service for managing properties in localStorage.
 * This service provides methods to get and set values in localStorage, with additional logging for development purposes.
 * It checks for the availability of localStorage before performing any operations and logs relevant information to the console.
 * The getValueOfLocalStorageByKey method retrieves a value from localStorage and converts it to a boolean if it's a string representation of a boolean.
 * The setValueOfLocalStorageByKey method sets a value in localStorage, converting it to a string before storage.
 * The log method is used for logging messages to the console in development mode, with support for different log levels (log, warn, error).
 * The service is provided in the root injector, making it available throughout the application.
 * Note: This service assumes that localStorage is available in the environment where it is used. If localStorage is not available, it will log an error message and return false for get operations or skip set operations.
 * @see https://angular.io/guide/dependency-injection for more information on Angular's dependency injection system.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage for more information on the localStorage API.
 * @see https://angular.io/guide/dev-mode for more information on Angular's development mode and logging practices.
 * @author [VictorHugoAguilar]
 * @version 1.0.0
 * @license MIT
 * @since 2026-05-04
 * @deprecated This service is intended for use in development and may not be suitable for production environments due to potential performance implications of logging and localStorage usage. Consider using a more robust state management solution for production applications.
 * @remarks This service is designed to be simple and focused on managing properties in localStorage, with an emphasis on logging for development purposes. It is not intended to be a comprehensive solution for state management or localStorage interactions in production applications. Use with caution and consider the implications of using localStorage in your application, especially regarding performance and security.
 * @example
 * import { Component } from '@angular/core'; 
 * import { PropertiesStorageService } from './services/properties-storage.service';    
 * @Component({
 *  selector: 'app-example',
 *   template: `<p>Check the console for localStorage operations.</p>`
 * })
 * export class ExampleComponent {
 *   constructor(private propertiesStorageService: PropertiesStorageService) {
 *     this.propertiesStorageService.setValueOfLocalStorageByKey('isFeatureEnabled', true);
 *     const isFeatureEnabled = this.propertiesStorageService.getValueOfLocalStorageByKey('isFeatureEnabled');
 *     console.log(isFeatureEnabled); // Output: true
 *   }
 * }
 */
@Injectable({
    providedIn: 'root'
})
export class PropertiesStorageService {
    /**
     * Retrieves a value from localStorage for the given key. If the value is a string representation of a 
     * boolean, it converts it to a boolean type before returning.
     * 
     * @param key 
     * @returns The value associated with the given key in localStorage, or false if localStorage is not 
     * available. If the value is a string representation of a boolean ('true' or 'false'), it returns the 
     * corresponding boolean value.
     * 
     * @remarks This method checks for the availability of localStorage before attempting to retrieve a value. 
     * If localStorage is not available, it logs an error message and returns false. If the retrieved value 
     * is a string representation of a boolean, it converts it to a boolean type before returning. Otherwise, 
     * it returns the raw value from localStorage.
     * @example
     * const propertiesStorageService = new PropertiesStorageService();
     * propertiesStorageService.setValueOfLocalStorageByKey('isFeatureEnabled', true);
     * const isFeatureEnabled = propertiesStorageService.getValueOfLocalStorageByKey('isFeatureEnabled');
     * console.log(isFeatureEnabled); // Output: true
     * propertiesStorageService.setValueOfLocalStorageByKey('username', 'JohnDoe');
     * const username = propertiesStorageService.getValueOfLocalStorageByKey('username');
     * console.log(username); // Output: 'JohnDoe'
     * propertiesStorageService.setValueOfLocalStorageByKey('isLoggedIn', 'false');
     * const isLoggedIn = propertiesStorageService.getValueOfLocalStorageByKey('isLoggedIn');
     * console.log(isLoggedIn); // Output: false    
     */
    getValueOfLocalStorageByKey(key: string): any {
        this.log(`Getting value from localStorage — key: "${key}"`);

        if (typeof localStorage === 'undefined') {
            this.log(`localStorage not available`, 'error');
            return false;
        }

        const storedValue = localStorage.getItem(key);
        this.log(`Value for key "${key}": ${storedValue}`);

        if (typeof Boolean(storedValue) === 'boolean') {
            return storedValue === 'true';
        }

        return storedValue
    }

    /**
     * Sets a value in localStorage for the given key. The value is converted to a string before being stored. If 
     * localStorage is not available, it logs an error message and skips the set operation.
     * 
     * @param key 
     * @param value 
     * @returns void
     * 
     * @remarks This method checks for the availability of localStorage before attempting to set a value. If 
     * localStorage is not available, it logs an error message and returns without performing any operation. 
     * If localStorage is available, it converts the provided value to a string and stores it under the specified key. 
     * It also logs the key and value being set for debugging purposes.
     * @example
     * const propertiesStorageService = new PropertiesStorageService();
     * propertiesStorageService.setValueOfLocalStorageByKey('isFeatureEnabled', true);
     * propertiesStorageService.setValueOfLocalStorageByKey('username', 'JohnDoe');
     * propertiesStorageService.setValueOfLocalStorageByKey('isLoggedIn', 'false');
     */
    setValueOfLocalStorageByKey(key: string, value: any): void {
        if (typeof localStorage === 'undefined') {
            this.log(`localStorage not available — skipping set for key: "${key}"`, 'error');
            return;
        }

        localStorage.setItem(key, String(value));
        this.log(`Set localStorage — key: "${key}", value: ${value}`);
    }

    /**
     * Logs a message to the console in development mode. The log level can be specified as 
     * 'log', 'warn', or 'error'.
     * @param message 
     * @param type 
     * @remarks This method checks if the application is running in development mode using Angular's 
     * isDevMode function. If it is in development mode, it logs the provided message to the console 
     * with a prefix indicating that it is from the PropertiesStorageService. The log level can be 
     * specified to differentiate between regular logs, warnings, and errors. In production mode, 
     * this method does not log anything to avoid performance implications and potential information leakage.
     * @example
     * const propertiesStorageService = new PropertiesStorageService();
     * this.log('This is a log message');
     * this.log('This is a warning message', 'warn');
     * this.log('This is an error message', 'error');
     */
    private log(message: string, type: 'log' | 'warn' | 'error' = 'log'): void {
        const timestamp = new Date().toISOString();

        const className = this.constructor.name;

        isDevMode() && console[type](`${timestamp} - [${className}] ${message}`);
    }

}

