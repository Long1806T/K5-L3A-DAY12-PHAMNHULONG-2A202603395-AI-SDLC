// Tiny WebGL1 renderer: flat-shaded lit meshes (hemisphere + moon + up to 8
// warm point lights + fog) and additive glow sprites / ground rings.

import { normalMat3 } from './mathx.js';
import { FLOATS_PER_VERTEX } from './meshes.js';

const MAX_LIGHTS = 8;

const LIT_VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec3 aCol; attribute float aEmit;
uniform mat4 uModel; uniform mat4 uViewProj; uniform mat3 uNormalMat;
varying vec3 vWorld; varying vec3 vNor; varying vec3 vCol; varying float vEmit;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz; vNor = uNormalMat * aNor; vCol = aCol; vEmit = aEmit;
  gl_Position = uViewProj * w;
}`;

const LIT_FS = `
precision highp float;
varying vec3 vWorld; varying vec3 vNor; varying vec3 vCol; varying float vEmit;
uniform vec3 uTint; uniform float uEmitScale;
uniform vec3 uSky; uniform vec3 uGround; uniform vec3 uMoonDir; uniform vec3 uMoonCol;
uniform vec3 uFogCol; uniform float uFogDensity; uniform vec3 uCamPos;
uniform int uNumLights; uniform vec3 uLightPos[${MAX_LIGHTS}]; uniform vec3 uLightCol[${MAX_LIGHTS}]; uniform float uLightRange[${MAX_LIGHTS}];
void main() {
  vec3 n = normalize(vNor);
  vec3 base = vCol * uTint;
  vec3 light = mix(uGround, uSky, n.y * 0.5 + 0.5);
  light += uMoonCol * max(dot(n, -uMoonDir), 0.0);
  for (int i = 0; i < ${MAX_LIGHTS}; i++) {
    if (i >= uNumLights) break;
    vec3 L = uLightPos[i] - vWorld;
    float d = length(L);
    float att = clamp(1.0 - d / uLightRange[i], 0.0, 1.0);
    att *= att;
    float nd = max(dot(n, L / max(d, 0.001)), 0.0) * 0.7 + 0.3;
    light += uLightCol[i] * att * nd;
  }
  float e = clamp(vEmit * uEmitScale, 0.0, 1.0);
  vec3 col = mix(base * light, base * 1.35 + vec3(0.08, 0.04, 0.0), e);
  float dist = length(vWorld - uCamPos);
  float f = 1.0 - exp(-(uFogDensity * dist) * (uFogDensity * dist));
  gl_FragColor = vec4(mix(col, uFogCol, clamp(f, 0.0, 1.0)), 1.0);
}`;

const GLOW_VS = `
attribute vec2 aCorner;
uniform vec3 uCenter; uniform vec3 uAxisU; uniform vec3 uAxisV; uniform float uSize; uniform mat4 uViewProj;
varying vec2 vUV; varying vec3 vWorld;
void main() {
  vUV = aCorner;
  vec3 w = uCenter + (uAxisU * aCorner.x + uAxisV * aCorner.y) * uSize;
  vWorld = w;
  gl_Position = uViewProj * vec4(w, 1.0);
}`;

const GLOW_FS = `
precision highp float;
varying vec2 vUV; varying vec3 vWorld;
uniform vec3 uColor; uniform float uMode; uniform float uRingWidth; uniform vec3 uCamPos; uniform float uFogDensity;
void main() {
  float r = length(vUV);
  float a;
  if (uMode < 0.5) {
    a = clamp(1.0 - r, 0.0, 1.0);
    a = a * a;
  } else {
    float edge = 1.0 - uRingWidth;
    a = (1.0 - smoothstep(0.0, uRingWidth, abs(r - edge))) * step(r, 1.0);
    a += 0.18 * smoothstep(1.0, 0.0, r) * step(r, 1.0);
  }
  float dist = length(vWorld - uCamPos);
  float k = exp(-(uFogDensity * dist) * (uFogDensity * dist));
  gl_FragColor = vec4(uColor * a * k, 1.0);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(`shader compile failed: ${gl.getShaderInfoLog(sh)}`);
  return sh;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program link failed: ${gl.getProgramInfoLog(p)}`);
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, info.name);
  }
  const a = {};
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) {
    const info = gl.getActiveAttrib(p, i);
    a[info.name] = gl.getAttribLocation(p, info.name);
  }
  return { p, u, a };
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL is not available in this browser');
    this.gl = gl;
    this.canvas = canvas;
    this.lit = program(gl, LIT_VS, LIT_FS);
    this.glow = program(gl, GLOW_VS, GLOW_FS);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    this.frame = null;
  }

  upload(floats) {
    const gl = this.gl;
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, floats, gl.STATIC_DRAW);
    return { vbo, count: floats.length / FLOATS_PER_VERTEX };
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
    return w / h;
  }

  /** frame = { viewProj, camPos, camRight, camUp, env: {sky, ground, moonDir, moonCol, fogCol, fogDensity}, lights: [{pos, col, range}] } */
  begin(frame) {
    const gl = this.gl;
    this.frame = frame;
    const f = frame.env.fogCol;
    gl.clearColor(f[0], f[1], f[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    const { p, u } = this.lit;
    gl.useProgram(p);
    gl.uniformMatrix4fv(u.uViewProj, false, frame.viewProj);
    gl.uniform3fv(u.uSky, frame.env.sky);
    gl.uniform3fv(u.uGround, frame.env.ground);
    gl.uniform3fv(u.uMoonDir, frame.env.moonDir);
    gl.uniform3fv(u.uMoonCol, frame.env.moonCol);
    gl.uniform3fv(u.uFogCol, frame.env.fogCol);
    gl.uniform1f(u.uFogDensity, frame.env.fogDensity);
    gl.uniform3fv(u.uCamPos, frame.camPos);
    const lights = frame.lights.slice(0, MAX_LIGHTS);
    gl.uniform1i(u.uNumLights, lights.length);
    if (lights.length) {
      gl.uniform3fv(u.uLightPos, lights.flatMap((l) => l.pos));
      gl.uniform3fv(u.uLightCol, lights.flatMap((l) => l.col));
      gl.uniform1fv(u.uLightRange, lights.map((l) => l.range));
    }
  }

  drawMesh(mesh, model, { tint = [1, 1, 1], emit = 1 } = {}) {
    const gl = this.gl;
    const { p, u, a } = this.lit;
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    const stride = FLOATS_PER_VERTEX * 4;
    gl.enableVertexAttribArray(a.aPos);
    gl.vertexAttribPointer(a.aPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(a.aNor);
    gl.vertexAttribPointer(a.aNor, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(a.aCol);
    gl.vertexAttribPointer(a.aCol, 3, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(a.aEmit);
    gl.vertexAttribPointer(a.aEmit, 1, gl.FLOAT, false, stride, 36);
    gl.uniformMatrix4fv(u.uModel, false, model);
    gl.uniformMatrix3fv(u.uNormalMat, false, normalMat3(model));
    gl.uniform3fv(u.uTint, tint);
    gl.uniform1f(u.uEmitScale, emit);
    gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }

  /** Additive sprites. items: [{center, size, color, ground?, ring?, ringWidth?, noFog?}] */
  drawGlows(items) {
    if (!items.length) return;
    const gl = this.gl;
    const { p, u, a } = this.glow;
    const f = this.frame;
    // the lit program's attributes must not leak into this draw
    for (const loc of Object.values(this.lit.a)) gl.disableVertexAttribArray(loc);
    gl.useProgram(p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(a.aCorner);
    gl.vertexAttribPointer(a.aCorner, 2, gl.FLOAT, false, 8, 0);
    gl.uniformMatrix4fv(u.uViewProj, false, f.viewProj);
    gl.uniform3fv(u.uCamPos, f.camPos);
    for (const g of items) {
      gl.uniform3fv(u.uCenter, g.center);
      if (g.ground) {
        gl.uniform3fv(u.uAxisU, [1, 0, 0]);
        gl.uniform3fv(u.uAxisV, [0, 0, 1]);
      } else {
        gl.uniform3fv(u.uAxisU, f.camRight);
        gl.uniform3fv(u.uAxisV, f.camUp);
      }
      gl.uniform1f(u.uSize, g.size);
      gl.uniform3fv(u.uColor, g.color);
      gl.uniform1f(u.uMode, g.ring ? 1 : 0);
      gl.uniform1f(u.uRingWidth, g.ringWidth ?? 0.08);
      gl.uniform1f(u.uFogDensity, g.noFog ? 0 : f.env.fogDensity * 0.8);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    gl.disableVertexAttribArray(a.aCorner);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }
}
