import { Tool } from "./Tool.js";
import { Dialog } from "../ui/Dialog.js";
import { WMSLoader } from "../io/gis/WMSLoader.js";
import * as THREE from "three";

class WmsImportTool extends Tool {
    constructor(application) {
        super(application);
        this.name = "wms_import";
        this.label = "tool.wms_import.label";
        this.help = "tool.wms_import.help";
        this.className = "wmsImport";
        this.immediate = true;
        this.urlInput = null;
        this.dialog = this.createDialog();
    }

    execute() {
        this.dialog.show();
    }

    createDialog() {
        this.dialog = new Dialog("title.wms_import");
        const dialog = this.dialog;
        
        dialog.setSize(400, 200);
        dialog.setI18N(this.application.i18n);

        const inputElem = document.createElement("input");
        inputElem.type = "text";
        inputElem.id = "wms_url_input";
        inputElem.placeholder = "URL";
        inputElem.style.width = "95%";
        inputElem.style.padding = "8px";
        
        this.urlInput = inputElem;

        dialog.bodyElem.appendChild(inputElem);

        dialog.addButton("import", "button.accept", event => this.importWmsUrl());
        dialog.addButton("close", "button.close", event => this.closeDialog());
        
        return dialog;
    }

    importWmsUrl() {
        const url = this.urlInput.value;

        if (!url || url.trim() === '') {
            alert("Si us plau, introdueix una URL vàlida.");
            return;
        }

        const projectOrigin = this.application.project?.origin || new THREE.Vector3();

        const loaderOptions = {
            targetCRS: 'EPSG:25831',
            origin: projectOrigin
        };
        const wmsLoader = new WMSLoader();
        wmsLoader.setOptions(loaderOptions);

        wmsLoader.load(
            url,
            (wmsData) => {
                const { mesh: wmsPlane, params: wmsParams, originalBbox, transformedBbox } = wmsData;

                const wmsLayer = new THREE.Group();
                const layerName = wmsParams.LAYERS || `WMS ${url.substring(0, 30)}...`;
                wmsLayer.name = layerName;

                wmsLayer.add(wmsPlane);
                
                wmsLayer.userData.WMS = {
                    url: url,
                    layers: wmsParams.LAYERS,
                    format: wmsParams.FORMAT,
                    crs: wmsParams.CRS || wmsParams.SRS,
                    originalBbox: originalBbox,
                    transformedBbox: transformedBbox
                };
                
                this.application.addObject(wmsLayer);

                this.application.zoomTo(wmsLayer);

                console.log("Capa WMS creada i afegida al projecte.");
                console.log("Objecte afegit:", wmsLayer);
                
                this.closeDialog();
            },
            (xhr) => {
                console.log((xhr.loaded / xhr.total * 100) + '% carregat');
            },
            (error) => {
                console.error("S'ha produït un error en carregar la imatge WMS:", error);
                alert("Error en carregar la imatge WMS. Comprova la URL i la consola per a més detalls.");
            }
        );
    }

    closeDialog() {
        if (this.urlInput) {
            this.urlInput.value = "";
        }
        this.dialog.hide();
    }
}

export { WmsImportTool };