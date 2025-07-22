/**
 * GMLLoader.js
 *
 * @author realor
 */

import { GISLoader } from "./GISLoader.js";
import * as THREE from "three";
import GML32 from 'ol/format/GML32.js';
import * as proj4Module from 'proj4';
import { register } from "ol/proj/proj4.js";

function getGMLOptions(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const memberEl = xmlDoc.querySelector(
    "*|member, *|featureMember, *|featureMembers"
  );

  if (!memberEl || !memberEl.firstElementChild) {
    console.warn("No feature member element was found.");
    return {};
  }

  const featureMemberTag = memberEl.tagName;
  const featureEl = memberEl.firstElementChild;
  const featureType = featureEl.localName;
  const featureNS = featureEl.namespaceURI;
  const geomQ = featureEl.querySelector(
    "*|Point, *|Polygon, *|LineString, *|MultiPoint, *|MultiPolygon, *|MultiLineString"
  );
  const geometryName = geomQ && geomQ.parentNode
    ? geomQ.parentNode.localName
    : null;
  
  if (!geometryName) {
    console.warn("Could not determine 'geometryName'.");
  }

  const srsEl = xmlDoc.querySelector("[srsName]");
  const srsName = srsEl
    ? srsEl.getAttribute("srsName").replace(
        /urn:ogc:def:crs:EPSG:(\d+)/,
        "EPSG:$1"
      )
    : null;

  const options = {
    featureNS,
    featureType
  };
  if (geometryName) {
    options.geometryName = geometryName;
  }
  if (srsName)              {options.srsName      = srsName;}
  if (featureMemberTag)     { options.featureMember = featureMemberTag;}

  return options;
}

class GMLLoader extends GISLoader
{
  constructor(manager)
  {
    super(manager, "text/xml; subtype=gml/3.1.1");
    proj4Module.default.defs(
        'EPSG:25831',
        '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs'
    );
    register(proj4Module.default);
  }

  parse(xml) {
    const xml2 = xml
      .replace(/urn:ogc:def:crs:EPSG:(\d+)/g, 'EPSG:$1')
      .replace(/(<\/?)ogr:/g, '$1gml:')
      .replace(/xmlns:ogr="[^"]*"\s*/g, '');

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml2, 'text/xml');

    const gmlOptions = getGMLOptions(xml2); 
    if (!gmlOptions.featureType || !gmlOptions.geometryName) {
      console.error("Incomplete GML options:", gmlOptions);
      this.manager.itemError(this.options.url);
      return null;
    }

    let features;
    try {
      const gmlFormat = new GML32(gmlOptions);
      features = gmlFormat.readFeatures(xmlDoc);
    } catch (err) {
      console.error("Error parsing with GML32:", err);
      this.manager.itemError(this.options.url);
      return null;
    }

    const featureGroup = new THREE.Group();
    featureGroup.name = this.options.name || "layer";

    if (!features.length) {
      console.warn("Warning: no features were found after parsing.");
    }

    for (const feature of features) {
      const olGeom = feature.getGeometry();
      const props = feature.getProperties();
      const id = feature.getId() || "feature";

      if (props.geometry) delete props.geometry;

      if (olGeom) {
        const type = olGeom.getType();
        const coords = olGeom.getCoordinates();
        this.createObject(type, id, coords, props, featureGroup);
      } else {
        this.createNonVisibleObject(id + "_nv", props, featureGroup);
      }
    }
    return featureGroup;
  }
}

export { GMLLoader };
