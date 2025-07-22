/*
 * WMSController.js
 *
 * @author realor (adapted for WMS)
 */

import { Controller } from "./Controller.js";
import { ObjectUtils } from "../utils/ObjectUtils.js";
import { ImageLoader } from "../io/gis/ImageLoader.js";
import * as THREE from "three";

class WMSController extends Controller {
    static WMS_LAYER_NAME = "wms_layer";

    constructor(object, name) {
        super(object, name);

        this.url = "https://your_server.com/wms";
        this.username = "username";
        this.password = "password";
        this.layer = "orto5m";
        this.format = "image/png";
        this.bbox = "420000,4581000,422000,4583000";
        this.width = 1024;
        this.height = 1024;
        this.crs = "EPSG:25831";
        this.transparent = true;

        this.origin = new THREE.Vector3(420878, 4582247, 0);

        this._onLoad = this.onLoad.bind(this);
        this._onProgress = this.onProgress.bind(this);
        this._onError = this.onError.bind(this);
    }

    onStart() {
        this.getMap();
    }

    onLoad(imageGroup) {
        const oldLayer = this.object.getObjectByName(WMSController.WMS_LAYER_NAME);
        if (oldLayer) {
            ObjectUtils.dispose(oldLayer);
            this.object.remove(oldLayer);
        }

        imageGroup.name = WMSController.WMS_LAYER_NAME;
        this.object.add(imageGroup);

        this.application.notifyObjectsChanged(this.object, this, "structureChanged");
        console.info("Capa WMS '" + this.layer + "' carregada correctament.");
    }

    getMap() {
        const loader = new ImageLoader();

        loader.options = {
            name: this.layer || "wms_layer",
            username: this.username,
            password: this.password,
            origin: this.origin,
            bbox: this.bbox,
            transparent: this.transparent
        };

        let requestUrl = this.url;
        requestUrl += (this.url.indexOf("?") === -1) ? "?" : "&";
        const params = new URLSearchParams({
            SERVICE: "WMS", VERSION: "1.3.0", REQUEST: "GetMap",
            LAYERS: this.layer, BBOX: this.bbox, WIDTH: this.width,
            HEIGHT: this.height, CRS: this.crs, FORMAT: this.format,
            TRANSPARENT: this.transparent.toString()
        });
        requestUrl += params.toString();
        loader.options.url = requestUrl;

        console.info("Carregant capa WMS '" + this.layer + "' amb ImageLoader...");
        loader.load(requestUrl, this._onLoad, this._onProgress, this._onError);
    }


    onError(error) {
        console.error("Error carregant la capa WMS '" + this.layer + "':", error);
    }

    static getDescription() {
        return "gis|controller." + this.name;
    }
}

Controller.addClass(WMSController);

export { WMSController };