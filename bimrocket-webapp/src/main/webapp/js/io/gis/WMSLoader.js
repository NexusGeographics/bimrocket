import * as THREE from "three";

// No funciona!! (encara)
function getVisibleWorldBounds(camera, projectOrigin) {
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const raycaster = new THREE.Raycaster();
    
    // Les 4 cantonades de la pantalla en coordenades normalitzades.
    const ndcCorners = [new THREE.Vector2(-1, 1), new THREE.Vector2(1, 1), new THREE.Vector2(1, -1), new THREE.Vector2(-1, -1)];
    const worldIntersectionPoints = [];

    // Llença un raig des de cada cantonada per veure on toca a terra.
    for (const corner of ndcCorners) {
        raycaster.setFromCamera(corner, camera);
        const intersectPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(groundPlane, intersectPoint)) {
            // Afegeix el punt d'intersecció, corregit amb l'origen del projecte.
            worldIntersectionPoints.push(intersectPoint.clone().add(projectOrigin));
        }
    }

    // Si no tenim 4 punts, alguna cosa ha anat malament (ex: càmera mirant al cel).
    if (worldIntersectionPoints.length < 4) { return null; }
    
    // Crea la caixa que engloba els punts. Això és la nostra BBOX visible.
    return new THREE.Box3().setFromPoints(worldIntersectionPoints);
}


/**
 * Carregador personalitzat per a capes WMS. S'encarrega de demanar les imatges
 * al servidor i actualitzar-les a l'escena segons la vista de la càmera.
 */
class WMSLoader extends THREE.Loader {
    constructor(manager) {
        super(manager);
        this.options = {};
        // El TextureLoader de Three.js carrega les imatges.
        this.textureLoader = new THREE.TextureLoader(this.manager);
        this.textureLoader.setCrossOrigin(this.crossOrigin || 'anonymous');
    }

    /**
     * Permet configurar opcions del loader des de fora.
     */
    setOptions(options) {
        this.options = { ...this.options, ...options };
        return this;
    }

    /**
     * Prepara la capa WMS, però no carrega la primera imatge encara.
     * Crea un objecte contenidor (Group) i li assigna la configuració i
     * la funció d'actualització.
     */
    load(url, onLoad, onProgress, onError) {
        const wmsLayer = new THREE.Group();
        wmsLayer.name = "Dynamic WMS Layer";

        // `userData` és el nostre magatzem de configuració i estat per aquesta capa.
        wmsLayer.userData.WMS = {
            baseUrl: url.split('?')[0],
            baseParams: this.getWMSParams(url),
            origin: this.options.origin,
            targetCRS: this.options.targetCRS,
            pixelsPerMeter: this.options.pixelsPerMeter || 10,
            updateThreshold: this.options.updateThreshold || 0.5, // % de moviment per refrescar
            zoomInThreshold: this.options.zoomInThreshold || 0.6, // llindar de zoom per refrescar
            zoomOutThreshold: this.options.zoomOutThreshold || 1.8,
            isLoading: false,
            currentMesh: null,
            lastLoadedBbox: null,
            boundaryBbox: this.getWMSParams(url).BBOX.split(',').map(Number) // BBOX màxima
        };

        // Assigna la funció `updateImage` a la capa, que serà cridada des de fora per refrescar-la.
        wmsLayer.update = (camera, projectOrigin) => this.updateImage(wmsLayer, camera, projectOrigin);
        if (onLoad) onLoad({ layer: wmsLayer });
    }

    /**
     * El cor del loader. Decideix si cal actualitzar la imatge, la demana i la canvia a l'escena.
     */
    updateImage(layer, camera, projectOrigin) {
        const wms = layer.userData.WMS;
        // Evita fer peticions noves si ja n'hi ha una en curs.
        if (wms.isLoading) return;

        const visibleBounds = getVisibleWorldBounds(camera, projectOrigin);
        if (!visibleBounds) return;

        let targetBbox = [visibleBounds.min.x, visibleBounds.min.z, visibleBounds.max.x, visibleBounds.max.z];
        
        // Si ja tenim una imatge carregada, ajustem la nova BBOX
        // perquè el seu centre coincideixi amb el centre de l'antiga.
        if (wms.lastLoadedBbox) {
            const lastCenterX = (wms.lastLoadedBbox[0] + wms.lastLoadedBbox[2]) / 2;
            const lastCenterZ = (wms.lastLoadedBbox[1] + wms.lastLoadedBbox[3]) / 2;

            const newWidth = targetBbox[2] - targetBbox[0];
            const newHeight = targetBbox[3] - targetBbox[1];

            // Reconstruïm la BBOX objectiu al voltant del centre de l'última imatge.
            targetBbox = [
                lastCenterX - newWidth / 2,
                lastCenterZ - newHeight / 2,
                lastCenterX + newWidth / 2,
                lastCenterZ + newHeight / 2,
            ];
        }

        // Comprova si l'usuari s'ha mogut o ha fet zoom prou com per justificar una nova petició.
        if (wms.lastLoadedBbox) {
            const lastW = wms.lastLoadedBbox[2] - wms.lastLoadedBbox[0];
            const currentW = targetBbox[2] - targetBbox[0];
            
            const lastCenterX = (wms.lastLoadedBbox[0] + wms.lastLoadedBbox[2]) / 2;
            const lastCenterZ = (wms.lastLoadedBbox[1] + wms.lastLoadedBbox[3]) / 2;
            const currentCenterX = (targetBbox[0] + targetBbox[2]) / 2;
            const currentCenterZ = (targetBbox[1] + targetBbox[3]) / 2;
            
            const panDist = Math.sqrt(Math.pow(currentCenterX - lastCenterX, 2) + Math.pow(currentCenterZ - lastCenterZ, 2));
            const panThreshold = lastW * wms.updateThreshold;
            const hasPannedEnough = panDist > panThreshold;

            const sizeRatio = lastW > 0 ? currentW / lastW : 0;
            const hasZoomedEnough = (sizeRatio < wms.zoomInThreshold) || (sizeRatio > wms.zoomOutThreshold);

            // Si no s'ha mogut prou, no fem res.
            if (!hasPannedEnough && !hasZoomedEnough) {
                return;
            }
        }
        
        // Bloqueja noves actualitzacions fins que aquesta acabi.
        wms.isLoading = true;

        // Retalla la BBOX demanada per no sortir dels límits originals del servei.
        const finalBbox = [
            Math.max(targetBbox[0], wms.boundaryBbox[0]), Math.max(targetBbox[1], wms.boundaryBbox[1]),
            Math.min(targetBbox[2], wms.boundaryBbox[2]), Math.min(targetBbox[3], wms.boundaryBbox[3])
        ];
        
        // Si la BBOX resultant no té àrea, cancel·lem.
        if (finalBbox[0] >= finalBbox[2] || finalBbox[1] >= finalBbox[3]) {
            wms.isLoading = false;
            return;
        }

        wms.lastLoadedBbox = finalBbox;

        // Calcula les dimensions de la imatge en píxels a partir dels metres i la resolució.
        const widthM = finalBbox[2] - finalBbox[0];
        const heightM = finalBbox[3] - finalBbox[1];
        let widthPx = Math.round(widthM * wms.pixelsPerMeter);
        let heightPx = Math.round(heightM * wms.pixelsPerMeter);
        // Limita la mida per no demanar imatges ni massa petites ni gegants.
        widthPx = Math.min(Math.max(widthPx, 64), 2048);
        heightPx = Math.min(Math.max(heightPx, 64), 2048);

        const imageUrl = this.createImageUrl(wms, finalBbox, widthPx, heightPx);
        
        // Càrrega asíncrona de la textura.
        this.textureLoader.load(imageUrl, (texture) => {
            // Important: elimina la geometria i el material de la capa antiga per alliberar memòria GPU.
            if (wms.currentMesh) {
                wms.currentMesh.geometry.dispose();
                if (wms.currentMesh.material && wms.currentMesh.material.map) {
                    wms.currentMesh.material.map.dispose(); 
                }
                if (wms.currentMesh.material) {
                    wms.currentMesh.material.dispose();
                }
                layer.remove(wms.currentMesh);
            }

            // Crea el nou pla amb la geometria i el material (la nova textura).
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
            const geometry = new THREE.PlaneGeometry(widthM, heightM);
            const mesh = new THREE.Mesh(geometry, material);

            const centerX = (finalBbox[0] + finalBbox[2]) / 2;
            const centerZ = (finalBbox[1] + finalBbox[3]) / 2;
            // El posiciona i el gira perquè quedi estirat a terra.
            mesh.position.set(centerX, 0, centerZ).sub(projectOrigin);
            mesh.rotateX(-Math.PI / 2);

            layer.add(mesh);
            wms.currentMesh = mesh;
            wms.isLoading = false;
        }, undefined, (error) => {
            console.error("Error carregant la imatge WMS", error);
            wms.isLoading = false;
        });
    }

    /**
     * Construeix la URL de la petició GetMap del WMS amb tots els paràmetres necessaris.
     */
    createImageUrl(wms, bbox, width, height) {
        const params = new URLSearchParams();
        // Aprofita els paràmetres originals de la URL, descartant els que calcularem nosaltres.
        for (const key in wms.baseParams) {
            const upperKey = key.toUpperCase();
            if (!['BBOX', 'WIDTH', 'HEIGHT', 'CRS', 'SRS'].includes(upperKey)) {
                params.set(key, wms.baseParams[key]);
            }
        }
        params.set('BBOX', bbox.join(','));
        params.set('WIDTH', width);
        params.set('HEIGHT', height);

        // Gestiona les diferències entre versions de WMS (CRS vs SRS).
        const wmsVersion = wms.baseParams.VERSION || '1.1.1';
        if (wmsVersion.startsWith('1.3')) params.set('CRS', wms.targetCRS);
        else params.set('SRS', wms.targetCRS);
        
        // Si el format és PNG, demanem transparència.
        const format = (wms.baseParams.FORMAT || 'image/png').toLowerCase();
        if (format.includes('png') || format.includes('gif')) params.set('TRANSPARENT', 'true');
        
        return `${wms.baseUrl}?${params.toString()}`;
    }

    /**
     * Funció d'utilitat per parsejar els paràmetres de la URL inicial.
     * Inclou un fallback per si la URL no està ben formada.
     */
    getWMSParams(urlString) {
        const params = {};
        try {
            const url = new URL(urlString);
            url.searchParams.forEach((value, key) => { params[key.toUpperCase()] = value; });
        } catch (e) {
            console.warn("URL podria no ser vàlida, intentant parsejar manualment.", e);
            const search = urlString.substring(urlString.indexOf('?') + 1);
            new URLSearchParams(search).forEach((value, key) => {
                params[key.toUpperCase()] = value;
            });
        }
        return params;
    }
}

export { WMSLoader };