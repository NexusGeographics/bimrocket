import { Tool } from "./Tool.js";
import { Dialog } from "../ui/Dialog.js";
import { WMSLoader } from "../io/gis/WMSLoader.js";
import * as THREE from "three";
import { ZoomAllTool } from "./ZoomAllTool.js";

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
    }

    execute() {
        this.cleanup();
        this.dialog.show();
    }

    createDialog() {
        const dialog = new Dialog("title.wms_import");
        dialog.setSize(400, 200);
        dialog.setI18N(this.application.i18n);
        const inputElem = document.createElement("input");
        inputElem.type = "text";
        inputElem.id = "wms_url_input";
        inputElem.placeholder = "URL del servei WMS (amb BBOX inicial)";
        inputElem.style.width = "95%";
        inputElem.style.padding = "8px";
        this.urlInput = inputElem;
        dialog.bodyElem.appendChild(inputElem);
        dialog.addButton("import", "button.accept", () => this.importWmsUrl());
        dialog.addButton("close", "button.close", () => this.closeDialog());
        return dialog;
    }

    importWmsUrl() {
        const url = this.urlInput.value;
        if (!url || url.trim() === '') {
            alert("Introdueix una URL vàlida.");
            return;
        }
        const wmsLoader = new WMSLoader();
        const initialWmsParams = wmsLoader.getWMSParams(url);
        let effectiveOrigin = this.application.project?.origin?.clone() || new THREE.Vector3(0, 0, 0);

        if (effectiveOrigin.lengthSq() === 0 && initialWmsParams.BBOX) {
            console.log("No hi ha origen de projecte. Es crearà un origen a partir del BBOX del WMS.");
            try {
                const bbox = initialWmsParams.BBOX.split(',').map(Number);
                const centerX = (bbox[0] + bbox[2]) / 2;
                const centerZ = (bbox[1] + bbox[3]) / 2;
                effectiveOrigin.set(centerX, 0, centerZ);
            } catch (e) {
                console.error("El BBOX de la URL inicial no és vàlid. No es pot centrar el mapa.", e);
            }
        }
        
        console.log("Origen efectiu utilitzat:", effectiveOrigin);

        wmsLoader.setOptions({
            tileSize: 500,
            origin: effectiveOrigin,
            targetCRS: 'EPSG:25831',
            viewDistance: 2
        });

        wmsLoader.load(
            url,
            (wmsData) => {
                const { layer } = wmsData;
                this.wmsLayer = layer;
                
                this.application.addObject(this.wmsLayer);

                this.updateListener = () => {
                    if (this.wmsLayer && this.wmsLayer.update) {
                        this.wmsLayer.update(this.application.camera, effectiveOrigin);
                    }
                };

                this.application.addEventListener("animation", this.updateListener);
                this.updateListener();

                if (initialWmsParams.BBOX) {
                    this.performInitialZoom(initialWmsParams.BBOX, effectiveOrigin);
                }

                this.closeDialog();
            },
            null,
            (error) => console.error("Error en configurar la capa WMS:", error)
        );
    }
    
    performInitialZoom(bboxString, projectOrigin) {
        try {
            const bbox = bboxString.split(',').map(Number);
            const width = bbox[2] - bbox[0];
            const height = bbox[3] - bbox[1];
            const centerX = (bbox[0] + bbox[2]) / 2;
            const centerZ = (bbox[1] + bbox[3]) / 2;

            const helperGeometry = new THREE.BoxGeometry(width, 0.1, height);
            const helperMaterial = new THREE.MeshBasicMaterial({ visible: false });
            const zoomHelper = new THREE.Mesh(helperGeometry, helperMaterial);
            zoomHelper.position.set(centerX, 0, centerZ).sub(projectOrigin);
            
            this.application.scene.add(zoomHelper);
            this.application.selection.clear();
            this.application.selection.add(zoomHelper);
            
            const zoomTool = new ZoomAllTool(this.application);
            zoomTool.execute();
            
            this.application.scene.remove(zoomHelper);
            helperGeometry.dispose();
            helperMaterial.dispose();
        } catch (e) {
            console.error("No s'ha pogut executar el zoom automàtic.", e);
        }
    }

    cleanup() {
        if (this.updateListener) {
            this.application.removeEventListener("animation", this.updateListener);
            this.updateListener = null;
        }
        if (this.wmsLayer) {
            this.application.removeObject(this.wmsLayer);
            this.wmsLayer = null;
        }
    }

    closeDialog() {
        if (this.urlInput) { this.urlInput.value = ""; }
        this.dialog.hide();
    }
}

export { WmsImportTool };