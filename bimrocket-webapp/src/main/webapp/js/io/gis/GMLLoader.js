/**
 * GMLLoader.js
 *
 * @author realor
 */

import { GISLoader } from "./GISLoader.js";
import * as THREE from "three";

class GMLLoader extends GISLoader
{
  constructor(manager)
  {
    super(manager, "text/xml; subtype=gml/3.1.1");
  }

  parse(xml)
  {
    console.log('hola');
    const featureGroup = new THREE.Group();
    featureGroup.name = this.options.name || "layer";

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "application/xml");

    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.error("Error parsing GML data: ", parserError.textContent);
      return featureGroup;
    }

    const featureMembers = xmlDoc.querySelectorAll("featureMember, gml\\:featureMember");

    for (let i = 0; i < featureMembers.length; i++)
    {
      const featureNode = featureMembers[i].firstElementChild;
      if (!featureNode) continue;
      
      const parsedFeature = this.parseFeature(featureNode, i);
      
      if (parsedFeature.geometryInfo)
      {
        this.createObject(
          parsedFeature.geometryInfo.type,
          parsedFeature.featureId || "feature",
          parsedFeature.geometryInfo.coordinates,
          parsedFeature.properties,
          featureGroup
        );
      }
      else
      {
        this.createNonVisibleObject(
          parsedFeature.featureId || "feature_nv",
          parsedFeature.properties,
          featureGroup
        );
      }
    }
    return featureGroup;
  }

  parseFeature(featureNode, index)
  {
    const featureId = featureNode.getAttribute("gml:id") || `feature_${index}`;
    const geometryResult = this.parseGeometry(featureNode);
    const properties = this.parseProperties(featureNode, geometryResult?.geometryContainerNode);
    
    return {
      featureId: featureId,
      geometryInfo: geometryResult?.geometryInfo,
      properties: properties
    };
  }

  parseGeometry(featureNode)
  {
    const gmlGeometrySelector = "Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon, " +
                                "gml\\:Point, gml\\:LineString, gml\\:Polygon, gml\\:MultiPoint, gml\\:MultiLineString, gml\\:MultiPolygon";
    
    const geometryNode = featureNode.querySelector(gmlGeometrySelector);
    if (!geometryNode) return null;
    
    const posListNode = geometryNode.querySelector("posList, gml\\:posList");
    if (!posListNode) return null;
    
    const geometryType = geometryNode.localName;
    const coordsStr = posListNode.textContent.trim();
    
    const geometryInfo = {
      type: geometryType,
      coordinates: this.parseGmlCoordinates(coordsStr, geometryType)
    };
    
    return {
      geometryInfo: geometryInfo,
      geometryContainerNode: geometryNode.parentElement
    };
  }

  parseProperties(featureNode, nodeToExclude)
  {
    const properties = {};
    for (const propertyNode of featureNode.children)
    {
      if (propertyNode !== nodeToExclude) 
      {
        properties[propertyNode.localName] = propertyNode.textContent;
      }
    }
    return properties;
  }

  parseGmlCoordinates(str, type)
  {
    const flatCoords = str.split(/\s+/).map(Number);
    const points = [];
    const dimension = 2; // TODO: Es podria llegir de l'atribut 'srsDimension'??

    for (let i = 0; i < flatCoords.length; i += dimension)
    {
      points.push(flatCoords.slice(i, i + dimension));
    }

    switch (type)
    {
      case "Point":
        return points[0];
      case "MultiPoint":
        return points;
      case "LineString":
        return points;
      case "Polygon":
        return [points];
      case "MultiLineString":
        return [points];
      case "MultiPolygon":
        return [[points]];
      default:
        return points;
    }
  }
}

export { GMLLoader };
