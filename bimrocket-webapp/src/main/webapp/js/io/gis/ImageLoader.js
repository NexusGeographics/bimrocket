import * as THREE from "three";

class ImageLoader extends THREE.Loader {
    constructor(manager) {
        super(manager);
        this.options = {};
        this.origin = new THREE.Vector3();
    }

    load(url, onLoad, onProgress, onError) {
        const options = this.options;
        if (options.origin) {
            this.origin.copy(options.origin);
        }

        const textureLoader = new THREE.TextureLoader(this.manager);
        
        if (options.username && options.password) {
            const loadingManager = textureLoader.manager || new THREE.LoadingManager();
            const auth = 'Basic ' + window.btoa(options.username + ':' + options.password);
            loadingManager.setURLModifier((url) => {
                textureLoader.setRequestHeader({ 'Authorization': auth });
                return url;
            });
            textureLoader.manager = loadingManager;
        }
        
        const onTextureLoad = (texture) => {
            const imageGroup = this.parse(texture);
            onLoad(imageGroup);
        };
        textureLoader.load(url, onTextureLoad, onProgress, onError);
    }

    parse(texture) {
        const group = new THREE.Group();
        group.name = this.options.name || 'image_layer';

        this.createImagePlane(texture, group);

        return group;
    }

    createImagePlane(texture, parent) {
        const { bbox, transparent = true, name = 'image_plane' } = this.options;

        if (!bbox) {
            console.error("ImageLoader requereix una 'bbox' a les opcions per posicionar la imatge.");
            
            const planeWidth = texture.image.width;
            const planeHeight = texture.image.height;
            const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
            const material = new THREE.MeshBasicMaterial({ map: texture, transparent: transparent, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = name;
            parent.add(mesh);
            return;
        }

        const bboxParts = bbox.split(',').map(Number);
        if (bboxParts.length !== 4 || bboxParts.some(isNaN)) {
            console.error("BBOX invàlida:", bbox);
            return;
        }
        const [xmin, ymin, xmax, ymax] = bboxParts;
        const planeWidth = xmax - xmin;
        const planeHeight = ymax - ymin;

        const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
        const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: transparent,
        side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = name;

        const centerX = xmin + planeWidth / 2;
        const centerY = ymin + planeHeight / 2;
        mesh.position.set(centerX, centerY, 0);
        mesh.position.sub(this.origin);

        mesh.userData.GIS = {
            type: 'WMS_Image',
            bbox: this.options.bbox,
            url: this.options.url
        };
        
        mesh.updateMatrix();
        parent.add(mesh);
    }
}

export { ImageLoader };