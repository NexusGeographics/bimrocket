// /**
//  * WMSController.js
//  *
//  * @author nexus
//  */

// import { Controller } from "./Controller.js";
// import { WMSLoader } from "../io/gis/WMSLoader.js";
// import { MapView } from "geo-three";
// import * as THREE from "three";
// import { MessageDialog } from "../ui/MessageDialog.js";
// import proj4 from 'proj4';

// proj4.defs("EPSG:3857", "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs");
// proj4.defs("EPSG:25831", "+proj=utm +zone=31 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs");

// class WMSController extends Controller
// {
//   static MAP_VIEW_NAME = "_wms_map_view";

//   constructor(object, name)
//   {
//     super(object, name);

//     this.url = ""; 
//     this.layers = "";
//     this.crs = "";
//     this.origin = new THREE.Vector3(0, 0, 0);

//     this.autoStart = true;

//     this._mapView = null;
//     this._onNodeChanged = this.onNodeChanged.bind(this);
//   }

//   onStart()
//   {
//     console.log("[WMSController] El mètode onStart() s'ha executat. El controlador està actiu.");
//     this.application.addEventListener("scene", this._onNodeChanged);
//     this.updateMap();
//   }

//   onStop()
//   {
//     this.application.removeEventListener("scene", this._onNodeChanged);
//     this.removeMap();
//   }

//   onNodeChanged(event)
//   {
//     if (event.type === "nodeChanged" && this.hasChanged(event))
//     {
//       console.log("[WMSController] Propietats canviades, actualitzant mapa...");
//       this.updateMap();
//     }
//   }

//   updateMap()
//   {
//     this.removeMap();

//     if (!this.url || !this.layers || !this.crs) {
//       console.warn("WMSController: Falten paràmetres (URL, layers, CRS) per crear el mapa.");
//       return;
//     }
    
//     if (this.crs.toUpperCase() !== "EPSG:3857") {
//         console.error("WMSController: Només es suporta CRS EPSG:3857.");
//         return;
//     }

//     try
//     {
//       const application = this.application;
//       const camera = application.camera;

//       const provider = new WMSLoader(this.url, this.layers, this.crs);
//       const mapView = new MapView(MapView.PLANAR, provider, camera);
      
//       mapView.name = WMSController.MAP_VIEW_NAME;
//       this._mapView = mapView; 

//       mapView.position.sub(this.origin);
//       mapView.updateMatrix();

//       this.object.add(mapView);
      
//       application.notifyObjectsChanged(this.object, this, "structureChanged");
//       console.log(`[WMSController] Capa WMS '${this.layers}' creada i afegida a l'objecte '${this.object.name}'.`);
      
//       application.repaint(); 

//     } 
//     catch (err)
//     {
//       console.error("Error durant la importació WMS:", err);
//       MessageDialog.create("ERROR", "Error durant la importació: " + err.message)
//         .setClassName("error")
//         .setI18N(this.application.i18n).show();
//     }
//   }

//   removeMap()
//   {
//     if (this._mapView)
//     {
//       if (this._mapView.dispose) {
//         this._mapView.dispose();
//       }
//       this._mapView.removeFromParent(); 
//       this._mapView = null;
//       this.application.notifyObjectsChanged(this.object, this, "structureChanged");
//     }
//   }

//   static getDescription()
//   {
//     return "gis|controller." + this.name;
//   }
// }

// Controller.addClass(WMSController);

// export { WMSController };