import { GMLLoader } from "../io/gis/GMLLoader.js";

async function loadGmlLayer(options)
{
  const { url, name, origin, targetProjection = 'EPSG:25831', extrusionHeight = 3 } = options;
  const loadingManager = bimrocket.loadingManager;
  const gmlLoader = new GMLLoader(loadingManager);

  gmlLoader.options =
  {
    name: name,
    url: url,
    targetProjection: targetProjection,
    extrusionHeight: extrusionHeight
  };
  gmlLoader.origin.set(origin.x, origin.y, origin.z || 0);

  const onCompleted = (objectGroup) =>
  {
    if (objectGroup && objectGroup.children.length > 0)
    {
      bimrocket.addObject(objectGroup, bimrocket.baseObject);
    }
    else
    {
      console.warn("The load completed but no object was generated.");
    }
  };

  const onError = (error) =>
  {
    console.error(`Error loading layer "${name}":`, error);
  };

  gmlLoader.load(url, onCompleted, undefined, onError);
}

export { loadGmlLayer };