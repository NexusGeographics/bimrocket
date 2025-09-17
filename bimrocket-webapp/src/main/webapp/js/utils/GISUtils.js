import { GMLLoader } from "../io/gis/GMLLoader.js";
import * as THREE from "three";

const loadScript = (url) => new Promise((resolve, reject) => {
  if (document.querySelector(`script[src="${url}"]`)) return resolve();
  const script = document.createElement('script');
  script.src = url;
  script.onload = resolve;
  script.onerror = reject;
  document.head.append(script);
});

async function loadGmlLayer(options) {
  const { url, name, origin, targetProjection = 'EPSG:25831', extrusionHeight = 3 } = options;

  try {
    if (typeof ol === 'undefined') await loadScript('https://cdn.jsdelivr.net/npm/ol@v7.3.0/dist/ol.js');
    if (typeof proj4 === 'undefined') await loadScript('https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.8.0/proj4.js');
  } catch (error) {
    console.error("Error loading external libraries:", error);
    return;
  }
  
  const loadingManager = bimrocket.loadingManager;
  const gmlLoader = new GMLLoader(loadingManager);

  gmlLoader.options = {
    name: name,
    url: url,
    targetProjection: targetProjection,
    extrusionHeight: extrusionHeight
  };
  gmlLoader.origin.set(origin.x, origin.y, origin.z || 0);

  const onCompleted = (objectGroup) => {
    if (objectGroup && objectGroup.children.length > 0) {
      bimrocket.addObject(objectGroup, bimrocket.baseObject);
    } else {
      console.warn("The load completed but no object was generated.");
    }
  };

  const onError = (error) => {
    console.error(`Error loading layer "${name}":`, error);
  };
  
  const fileLoader = new THREE.FileLoader(loadingManager);
  fileLoader.load(
    url,
    (responseText) => {
      try {
        const objectGroup = gmlLoader.parse(responseText);
        onCompleted(objectGroup);
      } catch (e) {
        onError(e);
      }
    },
    undefined,
    (errorEvent) => {
      onError(errorEvent);
    }
  );
}

export { loadGmlLayer };