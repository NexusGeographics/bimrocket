/**
 * GMLLoader.js
 *
 * @author realor
 */

import { GISLoader } from "./GISLoader.js";
import * as THREE from "three";
import GML from 'ol/format/GML.js';

class GMLLoader extends GISLoader
{
  constructor(manager)
  {
    super(manager, "text/xml; subtype=gml/3.1.1");
  }

  parse(xml)
  {
    const featureGroup = new THREE.Group();
    featureGroup.name = this.options.name || "layer";

    const gmlFormat = new GML();

    let features;
    try {
      features = gmlFormat.readFeatures(xml);
    }
    catch (error) {
      console.error("Error parsing GML data with OpenLayers: ", error);
      return featureGroup;
    }

    for (let i = 0; i < features.length; i++)
    {
      const feature = features[i];
      const geometry = feature.getGeometry();

      if (geometry)
      {
        const featureId = feature.getId() || `feature_${i}`;
        const geometryType = geometry.getType();
        const coordinates = geometry.getCoordinates();
        const properties = feature.getProperties();

        delete properties.geometry;

        this.createObject(
          geometryType,
          featureId,
          coordinates,
          properties,
          featureGroup
        );
      }
      else
      {
        const featureId = feature.getId() || `feature_nv_${i}`;
        const properties = feature.getProperties();

        this.createNonVisibleObject(
          featureId,
          properties,
          featureGroup
        );
      }
    }
    console.log('Feature Group: ', featureGroup);
    return featureGroup;
  }

}

export { GMLLoader };
