import * as THREE from "three";
import proj4 from 'proj4';

proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");
proj4.defs("EPSG:25831", "+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

class WMSLoader extends THREE.Loader {

  constructor(manager) {
    super(manager);
    this.options = {};
  }

  setOptions(options) {
    this.options = options;
    return this;
  }

  load(url, onLoad, onProgress, onError) {
    const options = this.options || {};

    const textureLoader = new THREE.TextureLoader(this.manager);
    textureLoader.setCrossOrigin(this.crossOrigin || 'anonymous');

    textureLoader.load(url,
      (texture) => {
        const wmsParams = this._getWMSParams(url);
        
        let bbox;
        if (wmsParams.BBOX) {
            bbox = wmsParams.BBOX.split(',').map(Number);
        } else {
            console.error("La URL del WMS no conté un paràmetre BBOX.");
            if (onError) onError(new Error("URL sense BBOX"));
            return;
        }

        const sourceCRS = wmsParams.SRS || wmsParams.CRS;
        const targetCRS = options.targetCRS;

        if (targetCRS && sourceCRS && sourceCRS.toUpperCase() !== targetCRS.toUpperCase()) {
            try {
                const transformer = proj4(sourceCRS, targetCRS);
                const minCoords = transformer.forward([bbox[0], bbox[1]]);
                const maxCoords = transformer.forward([bbox[2], bbox[3]]);
                bbox = [minCoords[0], minCoords[1], maxCoords[0], maxCoords[1]];
            } catch(e) {
                console.error(`Error transformant coordenades: ${e}.`);
            }
        }
        
        const planeWidth = bbox[2] - bbox[0];
        const planeHeight = bbox[3] - bbox[1];

        const material = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: wmsParams.TRANSPARENT ? wmsParams.TRANSPARENT.toLowerCase() === 'true' : false,
          side: THREE.DoubleSide
        });
        
        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const wmsPlane = new THREE.Mesh(geometry, material);

        const centerX = (bbox[0] + bbox[2]) / 2;
        const centerZ = (bbox[1] + bbox[3]) / 2;
        wmsPlane.position.set(centerX, 0, centerZ); // La Y del món és 0 (el terra)

        if (options.origin) {
          wmsPlane.position.sub(options.origin);
        }
        
        // Rotem el pla per deixar-lo pla sobre el "terra" (el pla XZ)
        wmsPlane.rotateX(-Math.PI / 2);

        if (onLoad) {
          onLoad(wmsPlane);
        }
      },
      onProgress,
      onError
    );
  }

  parse(data) {
    console.warn("WMSLoader.parse() no és aplicable. La lògica està dins de load().");
    return null;
  }
  
  _getWMSParams(urlString) {
    const params = {};
    try {
      const search = urlString.substring(urlString.indexOf('?') + 1);
      search.split('&').forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) {
          params[key.toUpperCase()] = decodeURIComponent(value);
        }
      });
    } catch (e) {
      console.error("Error parsejant els paràmetres de la URL del WMS:", e);
    }
    return params;
  }
}

export { WMSLoader };