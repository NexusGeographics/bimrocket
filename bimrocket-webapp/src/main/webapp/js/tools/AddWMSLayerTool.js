// /**
//  * AddWMSLayerTool.js
//  *
//  * @author nexus
//  */

// import { Tool } from "./Tool.js";
// import { WMSController } from "../controllers/WMSController.js";
// import { Dialog } from "../ui/Dialog.js";
// import { MessageDialog } from "../ui/MessageDialog.js";
// import * as THREE from "three";

// class AddWMSLayerTool extends Tool
// {
//     constructor(application, options)
//     {
//         super(application);
//         this.name = "add_wms_layer";
//         this.label = "tool.add_wms_layer.label";
//         this.help = "tool.add_wms_layer.help";
//         this.className = "add_wms_layer";

//         this.immediate = false;
//         this.dialog = this.createDialog();
        
//         this.setOptions(options);
//         application.addTool(this);
//     }

//     activate()
//     {
//         super.activate();
//         this.dialog.show();
//     }

//     deactivate()
//     {
//         super.deactivate();
//         this.dialog.hide();
//     }

//     createDialog()
//     {
//         const dialog = new Dialog("Importar capa WMS");
//         dialog.setSize(400, 250);
//         dialog.setI18N(this.application.i18n);

//         const urlInput = document.createElement("input");
//         urlInput.type = "text";
//         urlInput.value = "https://geoserveis.icgc.cat/icc_mapesmultibase/noutm/wms/service";
//         this.urlInput = urlInput;

//         const layersInput = document.createElement("input");
//         layersInput.type = "text";
//         layersInput.value = "topogris";
//         this.layersInput = layersInput;

//         const crsInput = document.createElement("input");
//         crsInput.type = "text";
//         crsInput.value = "EPSG:3857";
//         this.crsInput = crsInput;

//         [urlInput, layersInput, crsInput].forEach(input => {
//             input.style.width = "95%"; input.style.padding = "8px"; input.style.marginTop = "10px";
//             dialog.bodyElem.appendChild(input);
//         });

//         dialog.addButton("import", "button.accept", () => this.addWMS());
//         dialog.addButton("close", "button.close", () => this.closeDialog());
//         return dialog;
//     }

//     addWMS() 
//     {
//         const url = this.urlInput.value;
//         const layers = this.layersInput.value;
//         const crs = this.crsInput.value;
//         const application = this.application;

//         if (!url || !layers || !crs || crs.toUpperCase() !== "EPSG:3857") {
//             MessageDialog.create("ERROR", "URL, capa i CRS (EPSG:3857) són obligatoris.").setI18N(application.i18n).show();
//             return;
//         }

//         const group = new THREE.Group();
//         group.name = "WMS Layer - " + layers;
        
//         group.rotation.x = -Math.PI / 2;
//         group.position.set(253, 5668, -0.1);
//         group.updateMatrix();

//         if (!group.controllers) group.controllers = {};
//         const controller = new WMSController(group, "wms");
//         controller.url = url;
//         controller.layers = layers;
//         controller.crs = crs;
//         group.controllers["wms"] = controller;
        
//         application.addObject(group, null, false, true); 
        
//         application.selection.set(group);

//         this.closeDialog();
//     }

//     closeDialog()
//     {
//         this.dialog.hide();
//         this.application.useTool(null);
//     }
// }

// export { AddWMSLayerTool };