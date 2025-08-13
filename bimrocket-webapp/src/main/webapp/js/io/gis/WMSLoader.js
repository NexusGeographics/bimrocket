import { MapProvider } from "geo-three";
 
// Aquests valors defineixen els límits del món projectat (en metres).
const ORIGIN_X = -20037508.342789244; // Origen de coordenades X
const ORIGIN_Y =  20037508.342789244; // Origen de coordenades Y
const WORLD_W  =  20037508.342789244 * 2; // Amplada total del món

function extent3857(z, x, y) {
  const dim  = 2 ** z; // Nombre de tessel·les per eix en aquest nivell de zoom.
  const size = WORLD_W / dim; // Mida (amplada i alçada) d'una tessel·la en metres.
  
  // Calcula les coordenades geogràfiques de la tessel·la.
  const minX = ORIGIN_X + x * size;
  const maxX = minX + size;
  // Corregir l'ordre de les coordenades Y per evitar el miratge
  const minY = ORIGIN_Y - (y + 1) * size;
  const maxY = minY + size;
  
  return [minX, minY, maxX, maxY];
}

export class WMSLoader extends MapProvider {
  constructor(baseUrl, layers, crs, format = "image/png", transparent = true) {
    super(); 
    
    // Paràmetres de configuració del servei WMS
    this.baseUrl = baseUrl;
    this.layers = layers;
    this.crs = crs;
    this.format = format;
    this.transparent = transparent;
 
    // Propietats per a la gestió de tessel·les.
    this.tileSize = 256; // Mida de les tessel·les (en píxels)
    this.minZoom = 0;    // Zoom mínim
    this.maxZoom = 19;   // Zoom màxim
 
    // Només es demanaran tessel·les dins d'aquesta àrea.
    this.bounds = [136349, 5062523, 370929, 5297103];
  }

  fetchTile(zoom, x, y) {
    // Comprova si el nivell de zoom està dins del rang permès.
    if (zoom < this.minZoom || zoom > this.maxZoom) {
        return Promise.reject(new Error(`Zoom ${zoom} fora de rang`));
    }
 
    // Calcula el bounding box de la tessel·la en coordenades del mapa.
    const [minx, miny, maxx, maxy] = extent3857(zoom, x, y);
    console.log('X: ', x);
    console.log('Y: ', y);
    console.log('Zoom: ', zoom);
 
    // Si s'han definit límits (bounds) i la tessel·la està completament fora,
    // retorna una imatge transparent per evitar una petició de xarxa innecessària.
    if (this.bounds?.length === 4) {
        const [bx0, by0, bx1, by1] = this.bounds;
        const outside = maxx < bx0 || maxy < by0 || minx > bx1 || miny > by1;
        if (outside) {
            return new Promise((resolve) => {
                const c = document.createElement("canvas");
                c.width = c.height = this.tileSize;
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = c.toDataURL("image/png"); // Crea una imatge buida.
            });
        }
    }
 
    // Construeix la URL per a la sol·licitud GetMap del WMS
    const url = new URL(this.baseUrl);
    url.searchParams.set("SERVICE", "WMS");
    url.searchParams.set("VERSION", "1.1.1");
    url.searchParams.set("REQUEST", "GetMap");
    url.searchParams.set("LAYERS", this.layers);
    url.searchParams.set("STYLES", "");
    url.searchParams.set("SRS", this.crs);
    url.searchParams.set("BBOX", `${minx},${miny},${maxx},${maxy}`);
    url.searchParams.set("WIDTH", this.tileSize);
    url.searchParams.set("HEIGHT", this.tileSize);
    url.searchParams.set("FORMAT", this.format);
    url.searchParams.set("TRANSPARENT", String(this.transparent));

     console.log("URL de la tessel·la:", url.toString());
 
    // Retorna una promesa que gestiona la càrrega asíncrona de la imatge.
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; 
        img.onload = () => resolve(img);
        img.onerror = (err) => {
            console.error("Error carregant la imatge de la tessel·la:", url.toString(), err);
            reject(new Error(`Error en la petició WMS: ${url}`));
        };
        img.src = url.toString();
    });
  }
}