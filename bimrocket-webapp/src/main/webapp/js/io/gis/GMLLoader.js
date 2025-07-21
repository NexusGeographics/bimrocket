/**
 * GMLLoader.js
 *
 * @author realor
 */

import { GISLoader } from "./GISLoader.js";
import * as THREE from "three";
import GML32 from 'ol/format/GML32.js';
// import proj4 from '../../lib/proj4/index.js';
// import { register } from 'ol/proj/proj4';

function getGMLOptions(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");
  const GML_NS = "http://www.opengis.net/gml/3.2";

  const memberEl = xmlDoc.querySelector(
    "*|member, *|featureMember, *|featureMembers"
  );
  if (!memberEl || !memberEl.firstElementChild) {
    console.warn("No se encontró ningún elemento de miembro de feature.");
    return {};
  }
  const featureMemberTag = memberEl.tagName;

  const featureEl    = memberEl.firstElementChild;
  const featureType  = featureEl.localName;
  const featureNS    = featureEl.namespaceURI;

  const geomQ = featureEl.querySelector(
    "*|Point, *|Polygon, *|LineString, *|MultiPoint, *|MultiPolygon, *|MultiLineString"
  );
  const geometryName = geomQ && geomQ.parentNode
    ? geomQ.parentNode.localName
    : null;
  if (!geometryName) {
    console.warn("No se pudo determinar 'geometryName'.");
  }

  const srsEl   = xmlDoc.querySelector("[srsName]");
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

  console.log("Opciones GML detectadas:", options);
  return options;
}

class GMLLoader extends GISLoader
{
  constructor(manager)
  {
    super(manager, "text/xml; subtype=gml/3.1.1");
    // proj4.defs(
    //     'EPSG:25831',
    //     '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs'
    // );
    // register(proj4);
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
      console.error("Opciones GML incompletas:", gmlOptions);
      this.manager.itemError(this.options.url);
      return null;
    }

    let features;
    try {
      const gmlFormat = new GML32(gmlOptions);
      features = gmlFormat.readFeatures(xmlDoc);
      console.log(`OpenLayers ha leído ${features.length} feature(s).`, features);
    } catch (err) {
      console.error("Error al parsear con GML32:", err);
      this.manager.itemError(this.options.url);
      return null;
    }

    const featureGroup = new THREE.Group();
    featureGroup.name = this.options.name || "layer";

    if (features.length === 0) {
      console.warn("Advertencia: no se encontraron features tras el parseo.");
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

    console.log("Feature Group GML:", featureGroup);
    return featureGroup;
  }
}

export { GMLLoader };
