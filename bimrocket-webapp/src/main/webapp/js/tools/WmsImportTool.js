import { Tool } from "./Tool.js";
import { Dialog } from "../ui/Dialog.js";
import { WMSLoader } from "../io/gis/WMSLoader.js";
import { ObjectUtils } from "../utils/ObjectUtils.js"; // NOU: Necessitem zoomAll
import * as THREE from "three";
import { MapView, MapProvider } from "geo-three";
import proj4 from 'proj4';

// ... (definicions de proj4 sense canvis)
proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs");
proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs");
proj4.defs("EPSG:25831", "+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

class WmsImportTool extends Tool {
    constructor(application) {
        super(application);
        this.name = "wms_import";
        this.label = "tool.wms_import.label";
        this.help = "tool.wms_import.help";
        this.className = "wmsImport";
        this.immediate = true;
        this.dialog = this.createDialog();
        this.wmsLayerGroup = null; 
    }
    execute() { this.dialog.show(); }

    cleanup() {
        if (this.wmsLayerGroup) {
            console.log("Netejant la capa WMS anterior.");
            const mapView = this.wmsLayerGroup.getObjectByProperty('isMapView', true);
            if (mapView) {
                mapView.dispose();
            }
            this.application.removeObject(this.wmsLayerGroup);
            this.wmsLayerGroup = null;
        }
    }
    
    createDialog() {
        const dialog = new Dialog("title.wms_import");
        dialog.setSize(400, 250);
        dialog.setI18N(this.application.i18n);
        const urlInput = document.createElement("input");
        urlInput.type = "text";
        urlInput.value = "https://geoserveis.icgc.cat/icc_mapesmultibase/noutm/wms/service";
        this.urlInput = urlInput;
        const layersInput = document.createElement("input");
        layersInput.type = "text";
        layersInput.value = "topogris";
        this.layersInput = layersInput;
        const crsInput = document.createElement("input");
        crsInput.type = "text";
        crsInput.value = "EPSG:3857";
        this.crsInput = crsInput;
        [urlInput, layersInput, crsInput].forEach(input => {
            input.style.width = "95%";
            input.style.padding = "8px";
            input.style.marginTop = "10px";
            dialog.bodyElem.appendChild(input);
        });
        dialog.addButton("import", "button.accept", () => this.importWmsUrl());
        dialog.addButton("close", "button.close", () => this.closeDialog());
        return dialog;
    }
    
    importWmsUrl() {
        console.log("--- [DEBUG] Iniciant importació WMS ---");
        this.cleanup();

        const url = this.urlInput.value;
        const layers = this.layersInput.value;
        const crs = this.crsInput.value;

        if (!url || !layers || !crs) { return; }

        try {
            const provider = new WMSLoader(url, layers, crs);
            console.log("[DEBUG] WMSLoader (provider) creat.");

            // *** Utilitzem el teu BBOX de Catalunya com a límit *** //
            provider.bounds = [-1217.62, 4911850.33, 389940.33, 5321304.08];
            console.log("[DEBUG] Límits del provider (EPSG:3857):", provider.bounds);

            const mapView = new MapView(MapView.PLANAR, provider, this.application.camera);
            // mapView.scale.set(0.001, 0.001, 0.001);

            console.log("[DEBUG] MapView creat.");
            
            this.wmsLayerGroup = new THREE.Group();
            this.wmsLayerGroup.name = "WMS Layer - " + layers;
            this.wmsLayerGroup.add(mapView);

            // Calculem el centre del mapa i la seva mida
            const mapWidth = provider.bounds[2] - provider.bounds[0];
            const mapHeight = provider.bounds[3] - provider.bounds[1];
            const centerX = (provider.bounds[0] + provider.bounds[2]) / 2;
            const centerY = (provider.bounds[1] + provider.bounds[3]) / 2;
            
            // Creem el centre de l'escena a partir del centre del mapa
            const sceneCenter = new THREE.Vector3(centerX, 0, -centerY);

            // Afegim el grup a l'escena. Important fer-ho abans de manipular la càmera.
            this.application.addObject(this.wmsLayerGroup);

            const cam = this.application.camera;
            const orbitTool = this.application.tools["orbit"];

            if (cam && orbitTool) {
                // Calculem la distància necessària per enquadrar el mapa
                const aspect = this.application.container.clientWidth / this.application.container.clientHeight;
                const fovInRadians = THREE.MathUtils.degToRad(cam.fov);
                const distanceForHeight = (mapHeight / 2) / Math.tan(fovInRadians / 2);
                const distanceForWidth = (mapWidth / 2) / (Math.tan(fovInRadians / 2) * aspect);
                const distance = Math.max(distanceForHeight, distanceForWidth) * 1.05; // Un 5% de marge

                // La posició final de la càmera: al centre del mapa, però elevada en l'eix Y
                cam.position.set(sceneCenter.x, distance, sceneCenter.z);

                // Girem el grup del mapa i el posicionem.
                // Això es fa ARA perquè la càmera ja sap on mirar.
                this.wmsLayerGroup.position.copy(sceneCenter);
                this.wmsLayerGroup.rotation.x = -Math.PI / 2;

                // Sincronitzem l'eina d'òrbita amb el nou estat.
                orbitTool.center.copy(sceneCenter); // El nou punt de mira
                orbitTool.resetParameters(); // Forcem a recalcular theta, phi, radius, etc.

                // Assegurem que la càmera miri al lloc correcte.
                cam.lookAt(sceneCenter);

                // Ajustem el pla de tall llunyà i actualitzem la projecció
                cam.far = distance * 2 + mapHeight;
                cam.updateProjectionMatrix();

                console.log("[DEBUG] Càmera i OrbitTool ajustats. Nou centre:", orbitTool.center.clone(), "Nova posició càmera:", cam.position.clone());

                // Notifiquem a l'aplicació que la càmera ha canviat
                this.application.notifyObjectsChanged(cam, this);
            }

            this.closeDialog();
            console.log("--- [DEBUG] Importació WMS finalitzada correctament. ---");

        } catch (err) {
            // ... (gestió d'errors)
        }
    }

    closeDialog() {
        this.dialog.hide();
    }
}
export { WmsImportTool };