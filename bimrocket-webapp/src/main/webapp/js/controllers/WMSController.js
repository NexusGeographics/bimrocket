/**
 * WMSController.js
 *
 * @author nexus, realor
 */

import { Controller } from "./Controller.js";
import { MessageDialog } from "../ui/MessageDialog.js";
import { WMSLoader } from "../io/gis/WMSLoader.js";
import * as THREE from "three";
import { MapView, MapBoxProvider } from "geo-three";
import proj4 from 'proj4';

// Assegurem que les projeccions estiguin definides
if (!proj4.defs["EPSG:3857"]) {
  proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs");
}
if (!proj4.defs["EPSG:25831"]) {
  proj4.defs("EPSG:25831", "+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");
}

class WMSController extends Controller
{
  // static MAP_VIEW_NAME = "_wms_map_view";
  
  constructor(object, name)
  {
    super(object, name);
    this.url = "";
    this.layers = "";
    this.crs = "EPSG:3857";
    this.useMapboxHeight = false;
    this.useIcgcHeight = false;

    this._mapView = null;
    this._onNodeChanged = this.onNodeChanged.bind(this);

    this._lastUrl = null;
    this._lastLayers = null;
    this._lastCrs = null;
    this._lastUseMapboxHeight = false;
    this._lastUseIcgcHeight = false;
    this._lastOrigin = new THREE.Vector2();

    this.autoStart = true;
    this._isAnimating = false;
  }

  onStart()
  {
    this.application.addEventListener("scene", this._onNodeChanged);
    this.updateMap();
  }

  onStop()
  {
    this.application.removeEventListener("scene", this._onNodeChanged);
    this.removeMap();
  }

  onNodeChanged(event)
  {
    if (event.type === "nodeChanged" && this.hasChanged(event))
    {
      if (this.url !== this._lastUrl || 
          this.layers !== this._lastLayers || 
          this.crs !== this._lastCrs ||
          this.useMapboxHeight !== this._lastUseMapboxHeight ||
          this.useIcgcHeight !== this._lastUseIcgcHeight)
      {
        if (this.layers !== this._lastLayers && this.layers)
        {
          this.object.name = "WMS Layer - " + this.layers;
          this.application.notifyObjectsChanged(this.object, this, "nameChanged");
        }
        this.updateMap();
      }
    }
  }

  updateMap()
  {
    this.removeMap();

    if (!this.url || !this.layers || !this.crs) return;
    if (this.crs.toUpperCase() !== "EPSG:3857")
    {
        MessageDialog.create("ERROR", "message.wms_controller_invalid_crs", { crs: this.crs }).setI18N(this.application.i18n).show();
        return;
    }

    this._lastUrl = this.url;
    this._lastLayers = this.layers;
    this._lastCrs = this.crs;
    this._lastUseMapboxHeight = this.useMapboxHeight;
    this._lastUseIcgcHeight = this.useIcgcHeight;

    if (this.layers)
    {
      this.object.name = "WMS Layer - " + this.layers;
    }

    try
    {
      const application = this.application;
      const camera = application.camera;
      const provider = new WMSLoader(this.url, this.layers, this.crs);
      
      let heightProvider = null;
      let mapView = null;
      
      if (this.useMapboxHeight) {
        const mapboxApiKey = "pk.eyJ1IjoiYXZhbGxzIiwiYSI6ImNtaDkzMm40NDBhYWMyanIxbnVraGFqY2oifQ.iFeS28_97GcOTB5tUutR-Q";
        heightProvider = new MapBoxProvider(
          mapboxApiKey,
          "mapbox.terrain-rgb",
          MapBoxProvider.MAP_ID,
          "pngraw"
        );
        mapView = new MapView(MapView.HEIGHT, provider, heightProvider);
      } else {
        mapView = new MapView(MapView.PLANAR, provider, camera);
      }
      
      const renderer = new THREE.WebGLRenderer();
      
      provider.minZoom = 13;
      camera.position.z += 0.00001;
      mapView.name = "MapView";
      mapView.subDivisionsRays = 64;
      renderer.render(application.scene, camera);

      function animate() 
      {
          requestAnimationFrame(animate);
          mapView.updateMatrixWorld(camera);
          renderer.render(application.scene, camera);
      }
            
      animate();
      
      this._mapView = mapView;

      this.object.add(this._mapView);

      this.object.rotation.x = Math.PI/2;
      this.object.position.set
      (
          253,
          5668,
          -1.5
      );
      this.object.updateMatrix();
      this.object.updateMatrixWorld(true);

      application.notifyObjectsChanged(this.object, this);

      console.log(`[WMSController] WMS layer '${this.layers}' created.`);
    } 
    catch (err)
    {
      console.error("Error updating WMS map:", err);
    }
  }

  removeMap()
  {
    if (this._mapView) {
        if (this._mapView.dispose)
        {
          this._mapView.dispose();
        }
        this._mapView.removeFromParent();
        this._mapView = null;
        this.application.notifyObjectsChanged(this.object, this, "structureChanged");
    }
  }

  static getDescription()
  {
    return "gis|controller.WMSController";
  }
}

Controller.addClass(WMSController);

export { WMSController };