import { Tool } from "./Tool.js";
import { Dialog } from "../ui/Dialog.js";
import { WMSLoader } from "../io/gis/WMSLoader.js";
import * as THREE from "three";
import { ZoomAllTool } from "./ZoomAllTool.js";

/**
 * Eina per importar i gestionar una capa WMS dinàmica a l'escena.
 * Mostra un diàleg per introduir una URL i s'encarrega d'afegir,
 * actualitzar i netejar la capa.
 */
class WmsImportTool extends Tool {
    constructor(application) {
        super(application);
        this.name = "wms_import";
        this.label = "tool.wms_import.label";
        this.help = "tool.wms_import.help";
        this.className = "wmsImport";
        this.immediate = true;

        this.dialog = this.createDialog();
        this.wmsLayer = null;
        this.updateListener = null;

        // Limita les actualitzacions per no saturar el servidor WMS en moure la càmera.
        this.throttleDelay = 500; 
        this.lastUpdateTime = 0;
        this.wheelListener = null; 
    }

    /**
     * Punt d'entrada de l'eina. Neteja l'estat anterior i mostra el diàleg.
     */
    execute() {
        this.cleanup();
        this.dialog.show();
    }

    /**
     * Construeix la finestra de diàleg per introduir la URL del WMS.
     */
    createDialog() {
        const dialog = new Dialog("title.wms_import");
        dialog.setSize(400, 200);
        dialog.setI18N(this.application.i18n);
        
        const inputElem = document.createElement("input");
        inputElem.type = "text";
        inputElem.id = "wms_url_input";
        inputElem.placeholder = "URL del servei WMS (amb BBOX gran)";
        inputElem.style.width = "95%";
        inputElem.style.padding = "8px";
        this.urlInput = inputElem;
        
        dialog.bodyElem.appendChild(inputElem);
        dialog.addButton("import", "button.accept", () => this.importWmsUrl());
        dialog.addButton("close", "button.close", () => this.closeDialog());
        return dialog;
    }

    /**
     * Lògica principal: valida la URL, configura el loader i carrega la capa.
     */
    importWmsUrl() {
        const url = this.urlInput.value;
        if (!url || !url.toUpperCase().includes('BBOX=')) {
            alert("Introdueix una URL vàlida que contingui el paràmetre BBOX.");
            return;
        }
        
        const wmsLoader = new WMSLoader();

        // Determina l'origen del projecte. Si no n'hi ha, el calcula a partir del BBOX
        // inicial per centrar la vista i evitar problemes amb coordenades grans.
        let effectiveOrigin = this.application.project?.origin?.clone() || new THREE.Vector3(0, 0, 0);

        if (effectiveOrigin.lengthSq() === 0) {
            try {
                const initialWmsParams = wmsLoader.getWMSParams(url);
                const bbox = initialWmsParams.BBOX.split(',').map(Number);
                effectiveOrigin.set((bbox[0] + bbox[2]) / 2, 0, (bbox[1] + bbox[3]) / 2);
            } catch (e) { console.error("El BBOX de la URL inicial no és vàlid.", e); }
        }
        
        // Opcions per al carregador: SRS, origen i paràmetres d'actualització.
        wmsLoader.setOptions({
            origin: effectiveOrigin,
            targetCRS: 'EPSG:25831',
            pixelsPerMeter: 10,
            updateThreshold: 0.5,
            viewSizeFactor: 1.5 
        });

        // La càrrega és asíncrona. El codi dins el callback s'executa quan la capa està preparada.
        wmsLoader.load(url, (wmsData) => {
            this.wmsLayer = wmsData.layer;
            this.application.addObject(this.wmsLayer);

            // Listener per refrescar la imatge WMS quan es mou la càmera.
            this.updateListener = () => {
                const now = Date.now();
                if (now - this.lastUpdateTime > this.throttleDelay) {
                    if (this.wmsLayer?.update) {
                        this.wmsLayer.update(this.application.camera, effectiveOrigin);
                    }
                    this.lastUpdateTime = now; 
                }
            };
            
            this.application.addEventListener("animation", this.updateListener);
            this.application.addEventListener("camera-change-end", this.updateListener);

            // Listener de prova per la rodeta del ratolí.
            this.wheelListener = (event) => {
                console.log("S'ha fet zoom amb la rodeta!", event.deltaY > 0 ? "Zoom Out" : "Zoom In");
            };
            this.application.renderer.domElement.addEventListener('wheel', this.wheelListener);
            
            // Forcem una primera actualització i fem zoom a l'extensió.
            this.wmsLayer.update(this.application.camera, effectiveOrigin);
            this.performInitialZoomOnFirstLoad();

            this.closeDialog();
        }, null, (error) => console.error("Error en configurar la capa WMS:", error));
    }

    /**
     * Fa un "Zoom a l'extensió" automàtic a la capa acabada de carregar.
     * Utilitza un objecte 'helper' invisible per definir l'àrea del zoom.
     */
    performInitialZoomOnFirstLoad() {
        const checkInterval = setInterval(() => {
            // Espera a que el WMSLoader hagi carregat la primera imatge i tingui un BBOX.
            if (this.wmsLayer?.userData.WMS.lastLoadedBbox) {
                clearInterval(checkInterval);
                const bbox = this.wmsLayer.userData.WMS.lastLoadedBbox;
                const projectOrigin = this.wmsLayer.userData.WMS.origin;

                try {
                    // Crea una caixa invisible amb la mida i posició del BBOX.
                    const zoomHelper = new THREE.Mesh(
                        new THREE.BoxGeometry(bbox[2] - bbox[0], 0.1, bbox[3] - bbox[1]),
                        new THREE.MeshBasicMaterial({ visible: false })
                    );
                    zoomHelper.position.set((bbox[0] + bbox[2]) / 2, 0, (bbox[1] + bbox[3]) / 2).sub(projectOrigin);
                    
                    // L'afegeix, el selecciona, fa zoom i l'esborra.
                    this.application.scene.add(zoomHelper);
                    this.application.selection.clear();
                    this.application.selection.add(zoomHelper);
                    new ZoomAllTool(this.application).execute();

                    this.application.scene.remove(zoomHelper);
                    zoomHelper.geometry.dispose();
                    zoomHelper.material.dispose();
                } catch (e) { console.error("No s'ha pogut executar el zoom inicial.", e); }
            }
        }, 100);
    }
    
    /**
     * Mètode de neteja. Elimina la capa i els listeners.
     */
    cleanup() {
        if (this.updateListener) {
            this.application.removeEventListener("animation", this.updateListener);
            this.application.removeEventListener("camera-change-end", this.updateListener);
            this.updateListener = null;
        }

        if (this.wheelListener) {
            this.application.renderer.domElement.removeEventListener('wheel', this.wheelListener);
            this.wheelListener = null;
        }
        
        if (this.wmsLayer) {
            this.application.removeObject(this.wmsLayer);
            this.wmsLayer = null;
        }
    }
    
    /**
     * Tanca i reseteja el diàleg d'importació.
     */
    closeDialog() {
        if (this.urlInput) { this.urlInput.value = ""; }
        this.dialog.hide();
    }
}

export { WmsImportTool };