/*
 * ExtrudeTool.js
 *
 * @author realor
 */

import { Tool } from "./Tool.js";
import { Solid } from "../core/Solid.js";
import { Profile } from "../core/Profile.js";
import { ObjectBuilder } from "../builders/ObjectBuilder.js";
import { Extruder } from "../builders/Extruder.js";
import { PointSelector } from "../utils/PointSelector.js";
import { Controls } from "../ui/Controls.js";
import { I18N } from "../i18n/I18N.js";
import * as THREE from "three";

class ExtrudeTool extends Tool
{
  constructor(application, options)
  {
    super(application);
    this.name = "extrude";
    this.label = "tool.extrude.label";
    this.help = "tool.extrude.help";
    this.className = "extrude";
    this.depthStep = 0.1;
    this.setOptions(options);
    application.addTool(this);

    this.stage = 0;
    this.solid = null;
    this.depth = 0;

    this.extrudeLine = new THREE.Line3(
      new THREE.Vector3(0, 0, -100), new THREE.Vector3(0, 0, 100));

    this.extrudeLineWorld = new THREE.Line3(
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));

    this.matrixWorldInverse = new THREE.Matrix4();

    this.line = null;

    this._onPointerDown = this.onPointerDown.bind(this);
    this._onPointerUp = this.onPointerUp.bind(this);
    this._onPointerMove = this.onPointerMove.bind(this);
    this._onSelection = this.onSelection.bind(this);
    this._onContextMenu = this.onContextMenu.bind(this);

    this.extrudeMaterial = new THREE.LineBasicMaterial(
    {
      color : new THREE.Color(1, 0, 0),
      depthTest : false,
      linewidth: 1.5
    });

    this.createPanel();
  }

  activate()
  {
    this.panel.visible = true;
    const application = this.application;
    const container = application.container;
    container.addEventListener('contextmenu', this._onContextMenu, false);
    container.addEventListener('pointerdown', this._onPointerDown, false);
    container.addEventListener('pointerup', this._onPointerUp, false);
    container.addEventListener('pointermove', this._onPointerMove, false);
    application.addEventListener('selection', this._onSelection, false);
    this.prepareExtrusion();
  }

  deactivate()
  {
    this.panel.visible = false;
    const application = this.application;
    const container = application.container;
    container.removeEventListener('contextmenu', this._onContextMenu, false);
    container.removeEventListener('pointerdown', this._onPointerDown, false);
    container.removeEventListener('pointerup', this._onPointerUp, false);
    container.removeEventListener('pointermove', this._onPointerMove, false);
    application.removeEventListener('selection', this._onSelection, false);
    application.pointSelector.deactivate();
    this.removeExtrusionAxis();
  }

  createPanel()
  {
    this.panel = this.application.createPanel(this.label, "left", "panel_extrude");
    this.panel.preferredHeight = 140;

    this.panel.onClose = () => this.application.useTool(null);

    this.helpElem = document.createElement("div");
    this.panel.bodyElem.appendChild(this.helpElem);

    this.depthInputElem = Controls.addNumberField(this.panel.bodyElem,
      "extrude_depth", "label.depth", 0);
    this.depthInputElem.step = this.depthStep;
    this.depthInputElem.addEventListener("change", event =>
    {
      this.depth = parseFloat(this.depthInputElem.value);
      this.updateExtrusion();
    }, false);

    this.depthLabelElem = this.depthInputElem.parentElement.firstChild;

    this.buttonsElem = document.createElement("div");
    this.panel.bodyElem.appendChild(this.buttonsElem);

    this.applyButton = Controls.addButton(this.buttonsElem,
      "extrude_apply", "button.apply", event =>
    {
      this.depth = parseFloat(this.depthInputElem.value);
      this.updateExtrusion();
    });

    this.finishButton = Controls.addButton(this.buttonsElem,
      "revolve_finish", "button.finish", event =>
    {
      this.application.selection.clear();
    });
  }

  onPointerDown(event)
  {
    const application = this.application;

    if (!application.isCanvasEvent(event)) return;

    if (this.stage === 0)
    {
      this.setStage(1);
    }
  }

  onPointerMove(event)
  {
    const application = this.application;

    if (!application.isCanvasEvent(event)) return;

    const pointSelector = application.pointSelector;

    if (this.stage === 1)
    {
      const snap = pointSelector.snap;
      if (snap)
      {
        let vector = new THREE.Vector3();
        vector.copy(snap.positionWorld).applyMatrix4(this.matrixWorldInverse);
        let height = vector.z;

        vector.copy(this.solid.builder.direction).normalize();
        this.depth = height / vector.z;

        this.updateDepthInPanel();
        this.updateExtrusion();
      }
    }
  }

  onPointerUp(event)
  {
    const application = this.application;

    if (!application.isCanvasEvent(event)) return;

    if (this.stage === 1)
    {
      this.setStage(0);
    }
  }

  onSelection(event)
  {
    this.prepareExtrusion();
  }

  onContextMenu(event)
  {
    const application = this.application;

    if (!application.isCanvasEvent(event)) return;

    event.preventDefault();
  }

  setStage(stage)
  {
    this.stage = stage;

    const application = this.application;

    switch (stage)
    {
      case 0: // set depth value
        application.pointSelector.auxiliaryLines = [];
        application.pointSelector.deactivate();
        this.depthLabelElem.style.display = "";
        this.depthInputElem.disabled = false;
        this.depthInputElem.style.display = "";
        this.applyButton.style.display = "";
        this.finishButton.style.display = "";
        I18N.set(this.helpElem, "textContent", "tool.extrude.drag_pointer");
        application.i18n.update(this.helpElem);
        this.removeExtrusionAxis();
        break;

      case 1: // dynamic extrude
        application.pointSelector.clearAxisGuides();
        application.pointSelector.filter = PointSelector.VISIBLE_UNSELECTED_FILTER;
        application.pointSelector.auxiliaryPoints = [];
        application.pointSelector.auxiliaryLines = [this.extrudeLineWorld];
        application.pointSelector.activate();
        this.depthLabelElem.style.display = "";
        this.depthInputElem.disabled = true;
        this.depthInputElem.style.display = "";
        this.applyButton.style.display = "none";
        this.finishButton.style.display = "";
        I18N.set(this.helpElem, "textContent", "tool.extrude.drag_pointer");
        application.i18n.update(this.helpElem);
        this.addExtrusionAxis();
        break;

      case 2: // no object selected
        application.pointSelector.auxiliaryLines = [];
        application.pointSelector.deactivate();
        this.depthLabelElem.style.display = "none";
        this.depthInputElem.style.display = "none";
        this.applyButton.style.display = "none";
        this.finishButton.style.display = "none";
        I18N.set(this.helpElem, "textContent", "tool.extrude.select_object");
        application.i18n.update(this.helpElem);
        this.removeExtrusionAxis();
        break;
    }
  }

  prepareExtrusion()
  {
    const application = this.application;
    const object = application.selection.object;

    let solid;

    if (object instanceof Profile
        && !(object.parent instanceof Solid))
    {
      solid = this.extrudeProfile(object);
    }
    else if (object instanceof Profile
             && object.parent instanceof Solid
             && object.parent.builder instanceof Extruder
             && object.parent.getComponentCount() === 1)
    {
      solid = object.parent;
    }
    else if (object instanceof Solid
             && object.builder instanceof Extruder
             && object.getComponentCount() === 1
             && object.getComponent(0) instanceof Profile)
    {
      solid = object;
    }
    else
    {
      solid = null;
    }

    this.solid = solid;

    if (solid)
    {
      this.depth = solid.builder.depth;
      this.updateDepthInPanel();
      if (!application.selection.contains(solid))
      {
        application.selection.set(solid);
      }
      this.setStage(0);
    }
    else
    {
      this.depth = 0;
      this.setStage(2);
    }
  }

  extrudeProfile(profile)
  {
    const application = this.application;

    const parent = profile.parent;
    application.removeObject(profile);
    const solid = new Solid();
    solid.name = "Extrude";
    solid.builder = new Extruder(0);
    profile.matrix.decompose(solid.position, solid.rotation, solid.scale);
    solid.matrix.copy(profile.matrix);

    profile.visible = false;
    profile.matrix.identity();
    profile.matrix.decompose(
      profile.position, profile.rotation, profile.scale);

    solid.add(profile);
    ObjectBuilder.build(solid);
    application.addObject(solid, parent, false, true);

    return solid;
  }

  updateExtrusion()
  {
    const solid = this.solid;
    if (solid)
    {
      let extruder = solid.builder;
      if (this.depth !== extruder.depth)
      {
        extruder.depth = this.depth;
        solid.needsRebuild = true;
        ObjectBuilder.build(solid);
        this.application.notifyObjectsChanged(solid);
      }
    }
  }

  updateDepthInPanel()
  {
    const k = 10000000;
    this.depthInputElem.value = Math.round(this.depth * k) / k;
  }

  addExtrusionAxis()
  {
    const application = this.application;
    const solid = this.solid;

    let vector = new THREE.Vector3();
    vector.copy(solid.builder.direction).normalize().multiplyScalar(1000);
    this.extrudeLine.start.copy(vector);
    vector.negate();
    this.extrudeLine.end.copy(vector);

    let matrixWorld = solid.matrixWorld;
    this.extrudeLineWorld.copy(this.extrudeLine).applyMatrix4(matrixWorld);
    this.matrixWorldInverse.copy(matrixWorld).invert();

    if (this.line)
    {
      application.removeObject(this.line);
    }

    let geometryPoints = [];
    geometryPoints.push(this.extrudeLineWorld.start);
    geometryPoints.push(this.extrudeLineWorld.end);

    this.line = application.addOverlay(geometryPoints, false,
      this.extrudeMaterial).line;
    this.line.renderOrder = 10;

    application.repaint();
  }

  removeExtrusionAxis()
  {
    if (this.line)
    {
      this.application.removeObject(this.line);
      this.line = null;
    }
  }
}

export { ExtrudeTool };
