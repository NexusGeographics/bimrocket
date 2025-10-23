/**
 * GMLLoader.js
 *
 * @author nexus
 */

import { GISLoader } from "./GISLoader.js";
import * as THREE from "three";

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
    this.origin = new THREE.Vector3(0, 0, 0);
  }

  setOptions(options)
  {
    this.options = Object.assign({}, this.options, options);
    return this;
  }

  load(source, onLoad, onProgress, onError)
  {

    const scope = this;
    const onParseComplete = (gmlText) => {
      return scope.parse(gmlText)
      .then(result => {
        if (result) {
        if (onLoad) onLoad(result);
        scope.manager.itemEnd(source instanceof File ? source.name : source);
        } else {
        const error = new Error("GML parsing failed or did not return an object.");
        if (onError) onError(error);
        scope.manager.itemError(source instanceof File ? source.name : source);
        }
      })
      .catch(error => {
        if (onError) onError(error);
        scope.manager.itemError(source instanceof File ? source.name : source);
      });
    };

    ensureDependencies().then(() =>
    {
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
    }).catch(err =>
    {
      if (onError) onError(err);
      return;
    })
  }

  _getGMLOptions(xmlDoc)
  {
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

  _detectGMLVersion(xmlDoc)
  {
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

  _normalizeSRS(xmlDoc)
  {
    const srsElements = xmlDoc.querySelectorAll('[srsName]');
    srsElements.forEach(element => {
      let srsName = element.getAttribute('srsName');
      if (srsName) {
        srsName = srsName
          .replace(/[^"]*#(\d+)/g, 'EPSG:$1')
          .replace(/urn:ogc:def:crs:EPSG::(\d+)/g, 'EPSG:$1');
        element.setAttribute('srsName', srsName);
      }
    });
  }
 
  parse(data, loadCompleted)
  {
    return ensureDependencies().then(() => 
    {
      let xmlDoc;
      if (typeof data === 'string')
      {
        if (!data || data.trim().length === 0) return null;
        const parser = new DOMParser();
        xmlDoc = parser.parseFromString(data, "application/xml");
      }
      else if (data instanceof Document)
      {
        xmlDoc = data;
      }
      else
      {
        return null;
      }

      if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
        console.error("Error parsing GML string.");
        return null;
      }
  
      this._normalizeSRS(xmlDoc);
  
      const gmlOptions = this._getGMLOptions(xmlDoc);
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
        console.warn(`Projection ${sourceProjection} not defined in proj4.`);
        return null;
      }

      const version = this._detectGMLVersion(xmlDoc);
      const GMLFormat = (version && version.startsWith("3.2")) ? GML32 : GML3;
      const gmlFormat = new GMLFormat(gmlOptions);

      let features;
      try
      {
        features = gmlFormat.readFeatures(xmlDoc, {
          dataProjection: sourceProjection,
          featureProjection: this.options.targetProjection
        });
      }
      catch (err)
      {
        console.error("Error reading features from GML:", err);
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
          let coords = olGeom.getCoordinates();
          this.createObject(type, id, coords, props, featureGroup);
        }
        else
        {
          this.createNonVisibleObject(`${id}_nv`, props, featureGroup);
        }
      }
      if(loadCompleted){
        loadCompleted(featureGroup);
      }
      return featureGroup;
    });
  }
}

export { GMLLoader };