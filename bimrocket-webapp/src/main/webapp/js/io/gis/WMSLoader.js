import * as THREE from "three";
class WMSLoader extends THREE.Loader {
  constructor(manager) {
    super(manager);
    this.options = {};
    this.textureLoader = new THREE.TextureLoader(this.manager);
    this.textureLoader.setCrossOrigin(this.crossOrigin || 'anonymous');
  }

  setOptions(options) {
    this.options = { ...this.options, ...options };
    return this;
  }

  load(url, onLoad, onProgress, onError) {
    const wmsParams = this.getWMSParams(url);
    const wmsLayer = new THREE.Group();
    wmsLayer.name = wmsParams.LAYERS || `WMS Layer`;
    wmsLayer.userData.WMS = {
        baseUrl: url.split('?')[0],
        baseParams: wmsParams,
        loadedTiles: new Map(),
        tileSize: this.options.tileSize || 500,
        targetCRS: this.options.targetCRS,
        viewDistance: this.options.viewDistance || 1
    };
    wmsLayer.update = (camera, projectOrigin) => this.updateTiles(wmsLayer, camera, projectOrigin);

    if (onLoad) onLoad({ layer: wmsLayer });
  }

  updateTiles(layer, camera, projectOrigin) {
    const { tileSize, viewDistance } = layer.userData.WMS;
    const cameraWorldPos = new THREE.Vector3().copy(camera.position).add(projectOrigin);
    const centerTileX = Math.floor(cameraWorldPos.x / tileSize);
    const centerTileZ = Math.floor(cameraWorldPos.z / tileSize);

    for (let dx = -viewDistance; dx <= viewDistance; dx++) {
        for (let dz = -viewDistance; dz <= viewDistance; dz++) {
            const tileX = centerTileX + dx;
            const tileZ = centerTileZ + dz;
            this.loadSingleTile(layer, tileX, tileZ, projectOrigin);
        }
    }
  }

  loadSingleTile(layer, tileX, tileZ, projectOrigin) {
    const { loadedTiles, tileSize } = layer.userData.WMS;
    const tileKey = `tile_${tileX}_${tileZ}`;

    if (loadedTiles.has(tileKey)) return;

    loadedTiles.set(tileKey, { status: 'loading' });

    const minX = tileX * tileSize;
    const minZ = tileZ * tileSize;
    const maxX = (tileX + 1) * tileSize;
    const maxZ = (tileZ + 1) * tileSize;
    
    const tileBbox = [minX, minZ, maxX, maxZ];
    const tileUrl = this.createTileUrl(layer.userData.WMS, tileBbox);

    this.textureLoader.load(tileUrl,
        (texture) => {
            const material = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide
            });
            const geometry = new THREE.PlaneGeometry(tileSize, tileSize);
            const tileMesh = new THREE.Mesh(geometry, material);
            
            const centerX = (minX + maxX) / 2;
            const centerZ = (minZ + maxZ) / 2;
            
            tileMesh.position.set(centerX, 0, centerZ).sub(projectOrigin);
            
            tileMesh.rotateX(-Math.PI / 2);
            tileMesh.name = tileKey;

            layer.add(tileMesh);
            loadedTiles.set(tileKey, { status: 'loaded', mesh: tileMesh });
            console.log(`Rajola ${tileKey} (BBOX: ${tileBbox.join(',')}) carregada i afegida a '${layer.name}'.`);
        },
        undefined,
        (error) => {
            console.error(`Error carregant la rajola ${tileKey} desde ${tileUrl}`, error);
            loadedTiles.delete(tileKey);
        }
    );
  }

  createTileUrl(wmsData, bbox) {
      const params = new URLSearchParams();
      const baseParams = wmsData.baseParams;

      for (const key in baseParams) {
          const upperKey = key.toUpperCase();
          if (upperKey !== 'BBOX' && upperKey !== 'WIDTH' && upperKey !== 'HEIGHT' && upperKey !== 'CRS' && upperKey !== 'SRS') {
              params.set(key, baseParams[key]);
          }
      }

      params.set('BBOX', bbox.join(','));
      params.set('WIDTH', 256);
      params.set('HEIGHT', 256);
      
      const wmsVersion = baseParams.VERSION || '1.1.1';
      if (wmsVersion.startsWith('1.3')) {
          params.set('CRS', wmsData.targetCRS);
      } else {
          params.set('SRS', wmsData.targetCRS);
      }
      
      const format = (baseParams.FORMAT || 'image/png').toLowerCase();
      if (format.includes('png') || format.includes('gif')) {
          params.set('TRANSPARENT', 'true');
      }

      return `${wmsData.baseUrl}?${params.toString()}`;
  }

  getWMSParams(urlString) {
      const params = {};
      try {
          const url = new URL(urlString);
          url.searchParams.forEach((value, key) => {
              params[key] = value;
          });
      } catch (e) { console.error("Error parsing WMS URL params", e); }
      for (const key in params) {
          params[key.toUpperCase()] = params[key];
      }
      return params;
  }
}

export { WMSLoader };