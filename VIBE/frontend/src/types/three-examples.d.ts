declare module "three/examples/jsm/objects/MarchingCubes.js" {
  import { Mesh, Material } from "three";
  export class MarchingCubes extends Mesh {
    constructor(resolution: number, material?: Material, enableUvs?: boolean, enableColors?: boolean);
    isMarchingCubes: boolean;
    field: Float32Array;
    isolation: number;
    enableUvs: boolean;
    enableColors: boolean;
    reset(): void;
    addBall(x: number, y: number, z: number, strength: number, subtract: number): void;
    addPlaneX(strength: number, subtract: number): void;
    addPlaneY(strength: number, subtract: number): void;
    addPlaneZ(strength: number, subtract: number): void;
    update(): void;
  }
}
