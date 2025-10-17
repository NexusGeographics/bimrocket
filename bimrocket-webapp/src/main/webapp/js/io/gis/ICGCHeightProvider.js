import { MapProvider } from "geo-three";
import {XHRUtils} from "geo-three";


/**
 * ICGC Height Provider for accessing elevation data from the ICGC service. 
 * Based on MapboxProvider from https://raw.githubusercontent.com/tentone/geo-three/884092748bf5d3c7857717296d4bbcdce0e8772f/source/providers/MapBoxProvider.ts
 *
 */
export class ICGCHeightProvider extends MapProvider 
{
	/**
	 * Base adress of the mapbox service.
	 */
	static ADDRESS = 'https://geoserveis.icgc.cat/';

	/**
	 * Access the map data using a map style.
	 */
	static STYLE = 100;

	/**
	 * Access the map data using a map id.
	 */
	static MAP_ID = 101;

	/**
	 * Server API access token.
	 */
	apiToken;

	/**
	 * Map image tile format, the formats available are:
	 *  - png True color PNG
	 *  - png32 32 color indexed PNG
	 *  - png64 64 color indexed PNG
	 *  - png128 128 color indexed PNG
	 *  - png256 256 color indexed PNG
	 *  - jpg70 70% quality JPG
	 *  - jpg80 80% quality JPG
	 *  - jpg90 90% quality JPG
	 *  - pngraw Raw png (no interpolation)
	 */
	format;

	/**
	 * Flag to indicate if should use high resolution tiles
	 */
	useHDPI;

	/**
	 * Map tile access mode
	 *  - MapBoxProvider.STYLE
	 *  - MapBoxProvider.MAP_ID
	 */
	mode;

	/**
	 * Map identifier composed of \{username\}.\{style\}
	 *
	 * Some examples of the public mapbox identifiers:
	 *  - mapbox.mapbox-streets-v7
	 *  - mapbox.satellite
	 *  - mapbox.mapbox-terrain-v2
	 *  - mapbox.mapbox-traffic-v1
	 *  - mapbox.terrain-rgb
	 */
	mapId;

	/**
	 * Map style to be used composed of \{username\}/\{style_id\}
	 *
	 * Some example of the syles available:
	 *  - mapbox/streets-v10
	 *  - mapbox/outdoors-v10
	 *  - mapbox/light-v9
	 *  - mapbox/dark-v9
	 *  - mapbox/satellite-v9
	 *  - mapbox/satellite-streets-v10
	 *  - mapbox/navigation-preview-day-v4
	 *  - mapbox/navigation-preview-night-v4
	 *  - mapbox/navigation-guidance-day-v4
	 *  - mapbox/navigation-guidance-night-v4
	 */
	style;

	/**
	 * Mapbox api version
	 *  - mapbox/navigation-guidance-night-v4
	 */
	version;

	/**
	 * @param apiToken - Map box api token.
	 * @param id - Map style or map ID if the mode is set to MAP_ID.
	 * @param mode - Map tile access mode.
	 * @param format - Image format.
	 * @param useHDPI - If true uses high DPI mode.
	 */
	constructor(apiToken = '', id = '', mode = ICGCHeightProvider.STYLE, format = 'png', useHDPI = false, version = 'v4') 
	{
		super();
		console.log("ICGCHeightProvider constructor");
		this.apiToken = apiToken;
		this.format = format;
		this.useHDPI = useHDPI;
		this.mode = mode;
		this.mapId = id;
		this.style = id;
		this.version = version;
	}

	async getMetaData()
	{
		console.log("Fetching metadata...");
		const address = ICGCHeightProvider.ADDRESS + this.version + '/' + this.mapId + '.json?access_token=' + this.apiToken;
		console.log("Fetching metadata with address: ",address);
		const data = await XHRUtils.get(address);
		
		const meta = JSON.parse(data);
		this.name = meta.name;
		this.minZoom = meta.minZoom;
		this.maxZoom = meta.maxZoom;
		this.bounds = meta.bounds;
		this.center = meta.center;
	}

	fetchTile(zoom, x, y)
	{
		console.log("ICGCHeightProvider fetchTile:", zoom, x, y);
		var src = ICGCHeightProvider.ADDRESS + 'servei/catalunya/contextmaps-terreny-5m-rgb/wmts/' + zoom + '/' + x + '/' + y + '.' + this.format;
		console.log("Fetching tile with URL:",src);
		return new Promise((resolve, reject) => 
		{
			const image = document.createElement('img');
			image.onload = function() 
			{
				resolve(image);
			};
			image.onerror = function() 
			{
				reject();
			};
			image.crossOrigin = 'Anonymous';

			var src=ICGCHeightProvider.ADDRESS + 'servei/catalunya/contextmaps-terreny-5m-rgb/wmts/' + zoom + '/' + x + '/' + y + '.' + this. format;
			console.log("Fetching tile with URL:",src);
			image.src = src;
			
		});
	}
}