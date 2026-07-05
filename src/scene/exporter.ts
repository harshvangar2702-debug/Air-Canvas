import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * Export the given objects to a .gltf file and trigger a browser download.
 * We wrap them in a temporary Group so only the drawing (not lights/camera) is
 * exported (DESIGN §3 export; PRD F10). All processing is local — nothing leaves
 * the device.
 */
export function exportToGLTF(objects: THREE.Object3D[], filename = 'aircanvas.gltf'): void {
  const group = new THREE.Group();
  // Add clones so the live scene graph is untouched by the export.
  for (const obj of objects) group.add(obj.clone());

  const exporter = new GLTFExporter();
  exporter.parse(
    group,
    (result) => {
      const json = JSON.stringify(result, null, 2);
      const blob = new Blob([json], { type: 'model/gltf+json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    (error) => {
      console.error('[AirCanvas] GLTF export failed:', error);
    },
    { binary: false },
  );
}
