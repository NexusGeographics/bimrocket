/**
 * GMLLoader.js
 *
 * @author nexus
 */

import { GISLoader } from "./GISLoader.js";
import { Solid } from "../../core/Solid.js";
import { Extruder } from "../../builders/Extruder.js";
import { ObjectBuilder } from "../../builders/ObjectBuilder.js";
import { Profile } from "../../core/Profile.js";
import { ProfileGeometry } from "../../core/ProfileGeometry.js";
import * as THREE from "three";
import GML32 from 'ol/format/GML32.js';
import * as proj4Module from 'proj4';
import { register } from "ol/proj/proj4.js";

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

let GML3, GML32, proj4, olProj4Register;
let dependenciesPromise = null;

async function ensureDependencies()
{
  if (dependenciesPromise)
  {
    return dependenciesPromise;
  }

  dependenciesPromise = new Promise(async (resolve, reject) =>
  {
    try
    {
      const [
        GML3Module,
        GML32Module,
        olProj4Module,
        proj4Module
      ] = await Promise.all([
        import('ol/format/GML3.js'),
        import('ol/format/GML32.js'),
        import('ol/proj/proj4.js'),
        import('proj4')
      ]);

      GML3 = GML3Module.default;
      GML32 = GML32Module.default;
      proj4 = proj4Module.default;
      olProj4Register = olProj4Module.register;

      if (!proj4.defs['EPSG:25831'])
      {
        proj4.defs('EPSG:25831', '+proj=utm +zone=31 +ellps=GRS80 +units=m +no_defs');
      }
      olProj4Register(proj4);
      resolve();
    }
    catch (error)
    {
      console.error(error);
      dependenciesPromise = null;
      reject(error);
    }
  });

  return dependenciesPromise;
}

class GMLLoader extends GISLoader
{
  constructor(manager)
  {
    super(manager, "application/gml+xml", "text/xml");
    this.options = {
      extrusionHeight: 1,
      targetProjection: 'EPSG:25831',
      name: 'layer'
    };
    this.origin = new THREE.Vector2(0, 0);
  }

  setOptions(options)
  {
    this.options = Object.assign({}, this.options, options);
    return this;
  }

  setOrigin(origin)
  {
    this.origin = origin;
    return this;
  }

  async load(source, onLoad, onProgress, onError)
  {
    try
    {
      await ensureDependencies();
    }
    catch (err)
    {
      if (onError) onError(err);
      return;
    }

    const scope = this;
    const onParseComplete = async (gmlText) =>
    {
      try
      {
        const result = await scope.parse(gmlText);
        if (result)
        {
          if (onLoad) onLoad(result);
        }
        else
        {
          const error = new Error("GML parsing failed or did not return an object.");
          if (onError) onError(error);
        }
      }
      catch (error)
      {
        if (onError) onError(error);
        scope.manager.itemError(source instanceof File ? source.name : source);
      }
    };

    if (source instanceof File)
    {
      const reader = new FileReader();
      reader.onload = (event) => onParseComplete(event.target.result);
      reader.onerror = (event) =>
      {
        if (onError) onError(event);
        scope.manager.itemError(source.name);
      };
      reader.readAsText(source);
    }
    else if (typeof source === 'string')
    {
      const loader = new THREE.FileLoader(this.manager);
      loader.setPath(this.path);
      loader.setResponseType('text');
      loader.setRequestHeader(this.requestHeader);
      loader.setWithCredentials(this.withCredentials);
      loader.load(source, onParseComplete, onProgress, onError);
    }
    else
    {
      const errorMsg = "Invalid load source. It must be a URL (string) or a File object.";
      if (onError) onError(new Error(errorMsg));
    }
  }

  #getGMLOptions(xmlString)
  {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const memberEl = xmlDoc.querySelector("*|member, *|featureMember, *|featureMembers");
    if (!memberEl || !memberEl.firstElementChild)
    {
      return {};
    }
    const featureMemberTag = memberEl.tagName;
    const featureEl = memberEl.firstElementChild;
    const featureType = featureEl.localName;
    const featureNS = featureEl.namespaceURI;
    let geometryName = null;
    for (const feature of memberEl.children)
    {
      const geomQ = feature.querySelector("*|Point, *|Polygon, *|LineString, *|MultiPoint, *|MultiPolygon, *|MultiLineString, *|geom, *|geometry");
      if (geomQ && geomQ.parentNode)
      {
        geometryName = geomQ.parentNode.localName;
        break;
      }
    }

    const srsEl = xmlDoc.querySelector("[srsName]");
    const srsNameString = srsEl ? srsEl.getAttribute("srsName") : null;
    let srsName = null;
    if (srsNameString)
    {
      const match = srsNameString.match(/EPSG:[:]{0,2}(\d+)|#(\d+)$/);
      if (match)
      {
        const code = match[1] || match[2];
        srsName = `EPSG:${code}`;
      }
      else
      {
        srsName = srsNameString;
      }
    }

    const options = { featureNS, featureType };
    if (geometryName) { options.geometryName = geometryName; }
    if (srsName) { options.srsName = srsName; }
    if (featureMemberTag) { options.featureMemberTag = featureMemberTag; }
    return options;
  }

  #detectGMLVersion(xmlString)
  {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "text/xml");
    const rootElement = xmlDoc.documentElement;
    if (rootElement && rootElement.hasAttribute("version"))
    {
      return rootElement.getAttribute("version");
    }
    const featureCollection = xmlDoc.querySelector("FeatureCollection, *|FeatureCollection");
    if (featureCollection && featureCollection.hasAttribute("version"))
    {
      return featureCollection.getAttribute("version");
    }
    return "3.1.1";
  }

  #coordinatesToRing(coordinates)
  {
    const points = [];
    for (let i = 0; i < coordinates.length; i++)
    {
      const point = coordinates[i];
      const vector = new THREE.Vector2(point[0], point[1]);
      if (this.origin)
      {
        vector.sub(this.origin);
      }
      points.push(vector);
    }
    if (points.length > 1 && points[0].equals(points[points.length - 1]))
    {
      points.pop();
    }
    return points;
  }

  createPolygon(name, coordinates, properties, parent)
  {
    try
    {
      const extrusionHeight = this.options.extrusionHeight || 1;
      const outerRingPoints = this.#coordinatesToRing(coordinates[0]);
      if (outerRingPoints.length < 3)
      {
        return;
      }

      const shape = new THREE.Shape(outerRingPoints);
      shape.closePath();

      for (let i = 1; i < coordinates.length; i++)
      {
        const holePoints = this.#coordinatesToRing(coordinates[i]);
        if (holePoints.length >= 3)
        {
          const holePath = new THREE.Path(holePoints);
          holePath.closePath();
          shape.holes.push(holePath);
        }
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
    }
    catch (ex)
    {
      console.warn(`Error creating polygon "${name}":`, ex);
    }
  }

  async parse(data)
  {
    await ensureDependencies();

    let xmlString = (typeof data === 'string') ? data : (new XMLSerializer()).serializeToString(data);

    if (!xmlString || xmlString.trim().length === 0)
    {
      return null;
    }

    xmlString = xmlString
      .replace(/srsName="[^"]*#(\d+)"/g, 'srsName="EPSG:$1"')
      .replace(/urn:ogc:def:crs:EPSG::(\d+)/g, 'EPSG:$1')
      .replace(/(<\/?)ogr:/g, '$1');

    const gmlOptions = this.#getGMLOptions(xmlString);
    if (!gmlOptions.featureType || !gmlOptions.geometryName)
    {
      return null;
    }

    const sourceProjection = gmlOptions.srsName || this.options.srsName;
    if (!sourceProjection)
    {
      return null;
    }
    if (!proj4.defs[sourceProjection])
    {
      return null;
    }

    const version = this.#detectGMLVersion(xmlString);
    const GMLFormat = (version && version.startsWith("3.2")) ? GML32 : GML3;
    const gmlFormat = new GMLFormat(gmlOptions);

    let features;
    try
    {
      features = gmlFormat.readFeatures(xmlString, {
        dataProjection: sourceProjection,
        featureProjection: this.options.targetProjection
      });
    }
    catch (err)
    {
      return null;
    }

    const featureGroup = new THREE.Group();
    featureGroup.name = this.options.name || "layer";
    featureGroup.userData.units = "m";

    for (const feature of features)
    {
      const olGeom = feature.getGeometry();
      const props = feature.getProperties();
      const id = feature.getId() || "feature";

      delete props.geometry;

      if (olGeom)
      {
        const type = olGeom.getType();
        const coords = olGeom.getCoordinates();
        this.createObject(type, id, coords, props, featureGroup);
      }
      else
      {
        this.createNonVisibleObject(`${id}_nv`, props, featureGroup);
      }
    }

    console.log("Feature Group GML:", featureGroup);
    return featureGroup;
  }
}

export { GMLLoader };