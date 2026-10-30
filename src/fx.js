// Dust/smoke/spark particles (single Points draw call) and persistent skid marks (one InstancedMesh).
import * as THREE from 'three';

export class Particles {
  constructor(scene, max) {
    this.max = max; this.n = 0; this.i = 0;
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.max_life = new Float32Array(max); this.grow = new Float32Array(max); this.a0 = new Float32Array(max); this.s0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pos, 3), this.aCol = new THREE.BufferAttribute(this.col, 3), this.aSize = new THREE.BufferAttribute(this.size, 1), this.aAlpha = new THREE.BufferAttribute(this.alpha, 1);
    [this.aPos, this.aCol, this.aSize, this.aAlpha].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('position', this.aPos); g.setAttribute('color', this.aCol); g.setAttribute('size', this.aSize); g.setAttribute('alpha', this.aAlpha);
    this.mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uScale: { value: 400 } },
      vertexShader: 'attribute float size; attribute float alpha; attribute vec3 color; varying float vA; varying vec3 vC; uniform float uScale; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = clamp(size * uScale / max(0.5,-mv.z), 0.0, 160.0); vA = alpha; vC = color; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }' });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; this.pts.renderOrder = 5; scene.add(this.pts);
    for (let k = 0; k < max; k++) this.pos[k * 3 + 1] = -999;
  }
  emit(x, y, z, vx, vy, vz, life, size, grow, alpha, r, g, b) {
    const k = this.i; this.i = (this.i + 1) % this.max; const o = k * 3;
    this.pos[o] = x; this.pos[o + 1] = y; this.pos[o + 2] = z; this.vel[o] = vx; this.vel[o + 1] = vy; this.vel[o + 2] = vz; this.col[o] = r; this.col[o + 1] = g; this.col[o + 2] = b;
    this.life[k] = this.max_life[k] = life; this.s0[k] = size; this.grow[k] = grow; this.a0[k] = alpha; this.size[k] = size; this.alpha[k] = alpha;
  }
  update(dt, scale) {
    this.mat.uniforms.uScale.value = scale;
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) { if (this.alpha[k] !== 0) { this.alpha[k] = 0; } continue; }
      this.life[k] -= dt; const o = k * 3, f = Math.max(0, this.life[k] / this.max_life[k]);
      if (this.life[k] <= 0) { this.alpha[k] = 0; this.pos[o + 1] = -999; continue; }
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      const dr = Math.exp(-2.2 * dt); this.vel[o] *= dr; this.vel[o + 1] *= dr; this.vel[o + 2] *= dr;
      this.size[k] = this.s0[k] + this.grow[k] * (1 - f); this.alpha[k] = this.a0[k] * f;
    }
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }
}

export class Skids {
  constructor(scene, max) {
    this.max = max; this.i = 0; this.dirty = false;
    const g = new THREE.PlaneGeometry(0.24, 0.9); g.rotateX(-Math.PI / 2);
    this.m = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x050505, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }), max);
    this.m.frustumCulled = false; const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let k = 0; k < max; k++) this.m.setMatrixAt(k, z); scene.add(this.m);
    this.d = new THREE.Object3D();
  }
  add(x, z, h) { const d = this.d; d.position.set(x, 0.05, z); d.rotation.set(0, h, 0); d.scale.set(1, 1, 1); d.updateMatrix(); this.m.setMatrixAt(this.i, d.matrix); this.i = (this.i + 1) % this.max; this.dirty = true; }
  flush() { if (this.dirty) { this.m.instanceMatrix.needsUpdate = true; this.dirty = false; } }
  clear() { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let k = 0; k < this.max; k++) this.m.setMatrixAt(k, z); this.m.instanceMatrix.needsUpdate = true; this.i = 0; }
}
