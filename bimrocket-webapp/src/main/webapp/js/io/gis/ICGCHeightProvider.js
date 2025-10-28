import { MapProvider } from "geo-three";

export class ICGCHeightProvider extends MapProvider 
{
	static ADDRESS = 'https://geoserveis.icgc.cat/';
	service;
	format;

	constructor(service = 'contextmaps-terreny-5m-rgb', format = 'png') 
	{
		super();
		this.service = service;
		this.format = format;
		this.name = 'ICGC Height Provider';
		this.minZoom = 0;
		this.maxZoom = service.includes('terreny-5m') ? 14 : 16;
		this.bounds = [0.15, 40.5, 3.3, 42.9];
		this.center = [1.5, 41.5];
		this.isHeightProvider = true;
	}

	async getMetaData()
	{
		return Promise.resolve();
	}

	fetchTile(zoom, x, y)
	{
		if (zoom > this.maxZoom) {
			return Promise.reject(new Error(`Zoom level ${zoom} exceeds service maximum ${this.maxZoom}`));
		}

		const heightService = this.service.includes('terreny') ? this.service : 'contextmaps-terreny-5m-rgb';
		const src = ICGCHeightProvider.ADDRESS + 'servei/catalunya/' + heightService + '/wmts/' + zoom + '/' + x + '/' + y + '.' + this.format;
		
		return new Promise((resolve, reject) => 
		{
			const image = document.createElement('img');
			image.onload = function() 
			{
				resolve(image);
			};
			image.onerror = function() 
			{
				console.warn(`Height tile not available: zoom=${zoom}, x=${x}, y=${y}`);
				reject(new Error(`Height tile not available at zoom ${zoom}`));
			};
			image.crossOrigin = 'Anonymous';
			image.src = src;
		});
	}

	getHeightFromRGB(r, g, b)
	{
		return (r * 256 + g + b / 256) - 32768;
	}
}