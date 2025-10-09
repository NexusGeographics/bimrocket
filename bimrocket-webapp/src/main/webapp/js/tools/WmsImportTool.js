import { Tool } from "./Tool.js";
import { Dialog } from "../ui/Dialog.js";
import { WMSLoader } from "../io/gis/WMSLoader.js";
import { MessageDialog } from "../ui/MessageDialog.js";
import * as THREE from "three";
import { MapView } from "geo-three";
import proj4 from 'proj4';

// Projecció Web Mercator (EPSG:3857)
proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs");

// Projecció UTM zona 31N (EPSG:25831)
proj4.defs("EPSG:25831", "+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

class WmsImportTool extends Tool
{
    constructor(application)
    {
        super(application);
        this.name = "wms_import";
        this.label = "tool.wms_import.label";
        this.help = "tool.wms_import.help";
        this.className = "wmsImport";
        this.immediate = true;
        
        // Move wmsConfigs initialization before dialog creation
        this.wmsConfigs = {
            "icgc_orto_div_proxy": {
                label: "ICGC - Divisions + Orto",
                url: "https://geoserver.nexusgeografics.com/geoserver/bimrocket/wms",
                layer: "icgc_orto_divisions",
                crs: "EPSG:3857"
            },
            "icgc_topo": {
                label: "ICGC - Topogràfic gris",
                url: "https://geoserveis.icgc.cat/icc_mapesmultibase/noutm/wms/service",
                layer: "topogris",
                crs: "EPSG:3857"
            },
            "icgc_orto": {
                label: "ICGC - Ortofoto",
                url: "https://geoserveis.icgc.cat/icc_mapesmultibase/noutm/wms/service",
                layer: "orto",
                crs: "EPSG:3857"
            },
            "icgc_geologic": {
                label: "ICGC - Divisions administratives 3857",
                url: "https://geoserveis.icgc.cat/servei/catalunya/divisions-administratives/wms/service",
                layer: "divisions_administratives_capsdemunicipi_capcomarca,divisions_administratives_capsdemunicipi_capmunicipi,divisions_administratives_municipis_5000,divisions_administratives_municipis_50000,divisions_administratives_municipis_100000,divisions_administratives_municipis_250000,divisions_administratives_comarques_5000,divisions_administratives_comarques_50000,divisions_administratives_comarques_100000,divisions_administratives_comarques_250000,divisions_administratives_comarques_500000,divisions_administratives_comarques_1000000",
                crs: "EPSG:3857"
            },
            "icgc_geologic2": {
                label: "ICGC - Divisions administratives 25831",
                url: "https://geoserveis.icgc.cat/servei/catalunya/divisions-administratives/wms/service",
                layer: "divisions_administratives_capsdemunicipi_capcomarca,divisions_administratives_capsdemunicipi_capmunicipi,divisions_administratives_municipis_5000,divisions_administratives_municipis_50000,divisions_administratives_municipis_100000,divisions_administratives_municipis_250000,divisions_administratives_comarques_5000,divisions_administratives_comarques_50000,divisions_administratives_comarques_100000,divisions_administratives_comarques_250000,divisions_administratives_comarques_500000,divisions_administratives_comarques_1000000",
                crs: "EPSG:25831"
            }
        };
        
        this.dialog = this.createDialog();
        this.wmsLayerGroup = null;
    }

    execute()
    {
        this.dialog.show();
    }

    cleanup()
    {
        if (this.wmsLayerGroup)
        {
            if (this.wmsLayerGroup.parent)
            {
                const mapView = this.wmsLayerGroup.getObjectByProperty('isMapView', true);
                if (mapView) { mapView.dispose(); }
                this.application.removeObject(this.wmsLayerGroup, null, true);
            }
            this.wmsLayerGroup = null;
        }
    }

    createDialog()
    {
        const dialog = new Dialog("Importar capa WMS");
        dialog.setSize(400, 350);
        dialog.setI18N(this.application.i18n);

        const createLabeledInput = (labelText) => {
            const container = document.createElement("div");
            container.style.marginTop = "10px";
            
            const label = document.createElement("label");
            label.textContent = labelText;
            label.style.display = "block";
            label.style.marginBottom = "5px";
            
            const input = document.createElement("input");
            input.type = "text";
            input.style.width = "95%";
            input.style.padding = "8px";
            //input.readOnly = true;
            
            container.appendChild(label);
            container.appendChild(input);
            return { container, input };
        };

        // Create select for WMS configurations
        const selectContainer = document.createElement("div");
        selectContainer.style.marginTop = "10px";
        
        const selectLabel = document.createElement("label");
        selectLabel.textContent = "Selecciona configuració WMS:";
        selectLabel.style.display = "block";
        selectLabel.style.marginBottom = "5px";
        
        const configSelect = document.createElement("select");
        configSelect.style.width = "95%";
        configSelect.style.padding = "8px";

        selectContainer.appendChild(selectLabel);
        selectContainer.appendChild(configSelect);
        dialog.bodyElem.appendChild(selectContainer);

        // Create labeled inputs
        const { container: urlContainer, input: urlInput } = createLabeledInput("URL:");
        const { container: layersContainer, input: layersInput } = createLabeledInput("Capa:");
        const { container: crsContainer, input: crsInput } = createLabeledInput("CRS:");

        this.urlInput = urlInput;
        this.layersInput = layersInput;
        this.crsInput = crsInput;

        // Add options to select
        Object.entries(this.wmsConfigs).forEach(([key, config]) => {
            const option = document.createElement("option");
            option.value = key;
            option.text = config.label;
            configSelect.appendChild(option);
        });

        // Add change event listener
        configSelect.addEventListener("change", () => {
            const config = this.wmsConfigs[configSelect.value];
            urlInput.value = config.url;
            layersInput.value = config.layer;
            crsInput.value = config.crs;
        });

        // Add all elements to dialog
        dialog.bodyElem.appendChild(urlContainer);
        dialog.bodyElem.appendChild(layersContainer);
        dialog.bodyElem.appendChild(crsContainer);

        // Trigger initial load
        configSelect.dispatchEvent(new Event("change"));

        dialog.addButton("import", "button.accept", () => this.importWmsUrl());
        dialog.addButton("close", "button.close", () => this.closeDialog());
        
        return dialog;
    }

    importWmsUrl()
    {
        console.log("--- [DEBUG] Iniciant importació WMS ---");
        this.cleanup();

        const url = this.urlInput.value;
        const layers = this.layersInput.value;
        const crs = this.crsInput.value;

        if (!url || !layers || !crs)
        {
            MessageDialog.create("ERROR", "URL, capa i CRS són obligatoris.").show();
            return;
        }

        try
        {
            const application = this.application;
            const camera = application.camera;
            const provider = new WMSLoader(url, layers, crs);
            const renderer = new THREE.WebGLRenderer();
            const mapViewGeoT = new MapView(MapView.PLANAR, provider, camera);

            provider.minZoom = 13;
            camera.position.z += 0.00001;
            mapViewGeoT.name = "MapView";
            mapViewGeoT.subDivisionsRays = 64;
            renderer.render(application.scene, camera);

            function animate() 
            {
                requestAnimationFrame(animate);
                mapViewGeoT.updateMatrixWorld(camera);
                renderer.render(application.scene, camera);
            }
            
            animate();

            this.wmsLayerGroup = new THREE.Group();
            this.wmsLayerGroup.name = "WMS Layer - " + layers;
            this.wmsLayerGroup.add(mapViewGeoT);

            this.wmsLayerGroup.rotation.x = Math.PI/2;
            this.wmsLayerGroup.rotation.y = 0;

            // TODO - Fer-ho dinàmic.
            this.wmsLayerGroup.position.set
            (
                253,
                5668,
                -1.5
            );

            this.wmsLayerGroup.updateMatrix();
            this.wmsLayerGroup.updateMatrixWorld(true);

            application.addObject(this.wmsLayerGroup, application.baseObject);
            application.notifyObjectsChanged(camera, this);

            this.closeDialog();

            console.log("--- [DEBUG] Importació WMS finalitzada. ---");

        } catch (err)
        {
            console.error("Error durant la importació WMS:", err);
            MessageDialog.create("ERROR", "Error durant la importació: " + err.message)
              .setClassName("error")
              .setI18N(this.application.i18n).show();
        }
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

    closeDialog()
    {
        this.dialog.hide();
    }
}

export { WmsImportTool };