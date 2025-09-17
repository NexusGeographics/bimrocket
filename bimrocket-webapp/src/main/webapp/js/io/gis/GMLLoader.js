import { GISLoader } from "./GISLoader.js";
import { Solid } from "../../core/Solid.js";
import { Extruder } from "../../builders/Extruder.js";
import { ObjectBuilder } from "../../builders/ObjectBuilder.js";
import { Profile } from "../../core/Profile.js";
import { ProfileGeometry } from "../../core/ProfileGeometry.js";
import * as THREE from "three";

let ol, proj4;

class GMLLoader extends GISLoader {

  #getGMLOptions(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const memberEl = xmlDoc.querySelector("*|member, *|featureMember, *|featureMembers");
    if (!memberEl || !memberEl.firstElementChild) {
      console.warn("No feature member element found.");
      return {};
    }
    const featureMemberTag = memberEl.tagName;
    const featureEl = memberEl.firstElementChild;
    const featureType = featureEl.localName;
    const featureNS = featureEl.namespaceURI;
    let geometryName = null;
    for (const feature of memberEl.children) {
        const geomQ = feature.querySelector("*|Point, *|Polygon, *|LineString, *|MultiPoint, *|MultiPolygon, *|MultiLineString, *|geom, *|geometry");
        if (geomQ && geomQ.parentNode) {
            geometryName = geomQ.parentNode.localName;
            break;
        }
    }
    if (!geometryName) {
      console.warn("WARNING: Could not determine 'geometryName' from any of the features in the GML file.");
    }

    const srsEl = xmlDoc.querySelector("[srsName]");
    const srsNameString = srsEl ? srsEl.getAttribute("srsName") : null;
    let srsName = null;
    if (srsNameString) {
      const match = srsNameString.match(/EPSG:[:]{0,2}(\d+)|#(\d+)$/);
      if (match) {
        const code = match[1] || match[2];
        srsName = `EPSG:${code}`;
      } else {
        srsName = srsNameString;
      }
    }

    const options = { featureNS, featureType };
    if (geometryName) { options.geometryName = geometryName; }
    if (srsName) { options.srsName = srsName; }
    if (featureMemberTag) { options.featureMemberTag = featureMemberTag; }
    return options;
  }

  #detectGMLVersion(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const rootElement = xmlDoc.documentElement;
    if (rootElement && rootElement.hasAttribute("version")) { return rootElement.getAttribute("version"); }
    const featureCollection = xmlDoc.querySelector("FeatureCollection, *|FeatureCollection");
    if (featureCollection && featureCollection.hasAttribute("version")) { return featureCollection.getAttribute("version"); }
    return "3.1.1";
  }

  #coordinatesToRing(coordinates) {
    const points = [];
    for (let i = 0; i < coordinates.length - 1; i++) {
      const point = coordinates[i];
      const vector = new THREE.Vector2(point[0], point[1]);
      vector.sub(this.origin);
      points.push(vector);
    }
    return points;
  }

  constructor(manager) {
    super(manager, "application/gml+xml");

    ol = window.ol;
    proj4 = window.proj4;

    if (!ol || !proj4) {
      throw new Error("The OpenLayers (ol) and Proj4 (proj4) libraries are required for GMLLoader.");
    }

    if (!proj4.defs['EPSG:25831']) {
      proj4.defs('EPSG:25831', '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs');
      ol.proj.proj4.register(proj4);
    }
  }

  createPolygon(name, coordinates, properties, parent) {
    try {
      const extrusionHeight = this.options.extrusionHeight || 1;
      
      const outerRingPoints = this.#coordinatesToRing(coordinates[0]);
      const shape = new THREE.Shape(outerRingPoints);
      shape.closePath();

      for (let i = 1; i < coordinates.length; i++) {
        const holePoints = this.#coordinatesToRing(coordinates[i]);
        const holePath = new THREE.Shape(holePoints);
        holePath.closePath();
        shape.holes.push(holePath);
      }

      const profileGeometry = new ProfileGeometry(shape);
      const profile = new Profile(profileGeometry, this.lineMaterial);
      profile.name = `${name}_profile`;
      profile.visible = false;

      const solid = new Solid();
      this.setObjectProperties(solid, name, properties);
      solid.add(profile);
      
      const extruder = new Extruder(extrusionHeight);
      solid.builder = extruder;
      
      ObjectBuilder.build(solid);
      
      parent.add(solid);
      
    } catch (ex) {
      console.warn(`Error creating polygon "${name}":`, ex);
    }
  }
  
  parse(data) {
    const xmlString = (typeof data === 'string') ? data : (new XMLSerializer()).serializeToString(data);
    
    if (!xmlString || xmlString.trim().length === 0) {
      console.error("Error: The received GML is empty or invalid.");
      return null;
    }

    const gmlOptions = this.#getGMLOptions(xmlString);
    if (!gmlOptions.featureType || !gmlOptions.geometryName) {
      console.error("Could not determine 'featureType' or 'geometryName' from the GML.", gmlOptions);
      return null;
    }
    
    const sourceProjection = gmlOptions.srsName || this.options.srsName;
    if (!sourceProjection) {
      console.error(`The GML file does not specify a projection (srsName).`);
      return null;
    }
    if (!proj4.defs(sourceProjection)) {
      console.error(`The projection "${sourceProjection}" is not defined in proj4.`);
      return null;
    }
    
    const version = this.#detectGMLVersion(xmlString);
    const GMLFormat = (version && version.startsWith("3.2")) ? ol.format.GML32 : ol.format.GML3;
    const gmlFormat = new GMLFormat(gmlOptions);

    let features;
    try {
      features = gmlFormat.readFeatures(xmlString, {
        dataProjection: sourceProjection,
        featureProjection: this.options.targetProjection
      });
    } catch (err) {
      console.error(`OpenLayers error while reading features:`, err);
      return null;
    }
    
    const featureGroup = new THREE.Group();
    featureGroup.name = this.options.name || "layer";
    featureGroup.userData.units = "m";

    if (!features.length) {
      console.warn("Warning: no features found after parsing.");
    }
    
    for (const feature of features) {
      const olGeom = feature.getGeometry();
      const props = feature.getProperties();
      const id = feature.getId() || "feature";

      delete props.geometry;

      if (olGeom) {
        const type = olGeom.getType();
        const coords = olGeom.getCoordinates();
        this.createObject(type, id, coords, props, featureGroup);
      } else {
        this.createNonVisibleObject(`${id}_nv`, props, featureGroup);
      }
    }
    return featureGroup;
  }
}

export { GMLLoader };