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
            const mapView = this.wmsLayerGroup.getObjectByProperty('isMapView', true);
            if (mapView) { mapView.dispose(); }
            this.application.removeObject(this.wmsLayerGroup, null, true);
            this.wmsLayerGroup = null;
        }
    }

    createDialog()
    {
        const dialog = new Dialog("Importar capa WMS");
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
        
        [urlInput, layersInput, crsInput].forEach
        (
            input =>
            {
                input.style.width = "95%"; input.style.padding = "8px"; input.style.marginTop = "10px";
                dialog.bodyElem.appendChild(input);
            }
        );

        dialog.addButton
        (
            "import", "button.accept", () => this.importWmsUrl()
        );
        dialog.addButton
        (
            "close", "button.close", () => this.closeDialog()
        );
        return dialog;
    }

    importWmsUrl()
    {
        console.log("--- [DEBUG] Iniciant importació WMS ---");
        this.cleanup();

        const url = this.urlInput.value;
        const layers = this.layersInput.value;
        const crs = this.crsInput.value;

        if (!url || !layers || !crs || crs.toUpperCase() !== "EPSG:3857")
        {
            MessageDialog.create("ERROR", "URL, capa i CRS (EPSG:3857) són obligatoris.").show();
            return;
        }

        try
        {
            const application = this.application;
            const camera = application.camera;
            const provider = new WMSLoader(url, layers, crs);
            const mapView = new MapView(MapView.PLANAR, provider, camera);

            mapView.name = "MapView";

            this.wmsLayerGroup = new THREE.Group();
            this.wmsLayerGroup.name = "WMS Layer - " + layers;
            this.wmsLayerGroup.add(mapView);

            this.wmsLayerGroup.rotation.x = Math.PI/2;
            this.wmsLayerGroup.rotation.y = 0;

            this.wmsLayerGroup.position.set
            (
                253,
                5668,
                -0.1
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

    closeDialog()
    {
        this.dialog.hide();
    }
}

export { WmsImportTool };