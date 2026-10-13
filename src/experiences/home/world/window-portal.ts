import type { MeshBasicMaterial } from "three";

/** The baked trees are scenery seen through an opening, never room geometry. */
export const HOME_WINDOW = { left: 1.245, right: 2.863, bottom: 1.578, top: 5.142, z: -2.816 };

export function clipSceneryToWindow(material: MeshBasicMaterial) {
  const w = HOME_WINDOW;
  material.depthWrite = false;
  material.onBeforeCompile = shader => {
    shader.vertexShader = "varying vec3 vSceneryWorld;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>",
      "#include <begin_vertex>\nvSceneryWorld = (modelMatrix * vec4(position, 1.0)).xyz;");
    shader.fragmentShader = "varying vec3 vSceneryWorld;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace("#include <clipping_planes_fragment>", `
      #include <clipping_planes_fragment>
      // Project this fragment's sightline onto the actual window opening.
      // No invisible boxes write depth over the architecture during orbit.
      float dz = vSceneryWorld.z - cameraPosition.z;
      if (cameraPosition.z <= ${w.z} || abs(dz) < 0.0001) discard;
      float t = (${w.z} - cameraPosition.z) / dz;
      vec3 opening = mix(cameraPosition, vSceneryWorld, t);
      if (t <= 0.0 || t >= 1.0 || opening.x < ${w.left} || opening.x > ${w.right}
          || opening.y < ${w.bottom} || opening.y > ${w.top}) discard;
    `);
  };
  material.customProgramCacheKey = () => "home-window-portal-v1";
}
