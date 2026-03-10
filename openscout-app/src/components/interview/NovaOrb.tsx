"use client";

import { useRef, useEffect } from "react";
import * as THREE from "three";

/* ================================================================
   GLSL UTILITIES — Simplex 3D + Worley noise + FBM
   ================================================================ */
const GLSL_NOISE = /* glsl */ `
// ── Simplex 3D (Ashima / Stefan Gustavson) ──
vec3 mod289(vec3 x){return x-floor(x/289.)*289.;}
vec4 mod289(vec4 x){return x-floor(x/289.)*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}

float snoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.);
  const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.-g;
  vec3 i1=min(g,l.zxy);vec3 i2=max(g,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.,i1.z,i2.z,1.))
   +i.y+vec4(0.,i1.y,i2.y,1.))
   +i.x+vec4(0.,i1.x,i2.x,1.));
  float n_=.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.;vec4 s1=floor(b1)*2.+1.;
  vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.);
  m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

// ── Worley / Cellular noise ──
vec3 hash3(vec3 p){
  p=vec3(dot(p,vec3(127.1,311.7,74.7)),
         dot(p,vec3(269.5,183.3,246.1)),
         dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p)*43758.5453123);
}

float worley(vec3 p){
  vec3 i_st=floor(p);vec3 f_st=fract(p);
  float minDist=1.0;
  for(int x=-1;x<=1;x++)
  for(int y=-1;y<=1;y++)
  for(int z=-1;z<=1;z++){
    vec3 neighbor=vec3(float(x),float(y),float(z));
    vec3 point=hash3(i_st+neighbor);
    vec3 diff=neighbor+point-f_st;
    float dist=length(diff);
    minDist=min(minDist,dist);
  }
  return minDist;
}

// ── Combined FBM for deep organic folds ──
float turbulentDisplacement(vec3 p, float t){
  float n = snoise(p * 0.8 + t * 0.25) * 1.0;
  n += snoise(p * 1.6 + t * 0.4) * 0.5;
  n += snoise(p * 3.2 + t * 0.6) * 0.25;
  float w = worley(p * 1.5 + t * 0.15);
  n -= (1.0 - w) * 0.6;
  vec3 warped = p + vec3(
    snoise(p * 1.2 + t * 0.3),
    snoise(p * 1.2 + 100.0 + t * 0.3),
    snoise(p * 1.2 + 200.0 + t * 0.3)
  ) * 0.4;
  n += snoise(warped * 1.8 + t * 0.35) * 0.35;
  return n;
}
`;

const VERT = /* glsl */ `
${GLSL_NOISE}

uniform float uTime;
uniform float uAmplitude;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying float vDisp;

void main(){
  float t = uTime;
  float d = turbulentDisplacement(normal, t) * uAmplitude;
  vec3 newPos = position + normal * d;
  vDisp = d;

  float e = 0.005;
  vec3 t1 = normalize(cross(normal, vec3(0.,1.,0.)));
  if(length(t1)<0.01) t1 = normalize(cross(normal, vec3(1.,0.,0.)));
  vec3 t2 = normalize(cross(normal, t1));
  float dA = turbulentDisplacement(normalize(position+t1*e), t) * uAmplitude;
  float dB = turbulentDisplacement(normalize(position+t2*e), t) * uAmplitude;
  vec3 pA = (position+t1*e) + normalize(position+t1*e) * dA;
  vec3 pB = (position+t2*e) + normalize(position+t2*e) * dB;
  vNormal = normalize(cross(pA - newPos, pB - newPos));

  vec4 wp = modelMatrix * vec4(newPos, 1.0);
  vWorldPos = wp.xyz;
  vViewDir = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
${GLSL_NOISE}

uniform float uTime;

varying vec3 vNormal;
varying vec3 vWorldPos;
varying vec3 vViewDir;
varying float vDisp;

float distributionGGX(vec3 N, vec3 H, float roughness){
  float a = roughness * roughness;
  float a2 = a * a;
  float NdH = max(dot(N, H), 0.0);
  float denom = NdH * NdH * (a2 - 1.0) + 1.0;
  return a2 / (3.14159265 * denom * denom);
}

float geometrySchlickGGX(float NdV, float roughness){
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return NdV / (NdV * (1.0 - k) + k);
}

float geometrySmith(vec3 N, vec3 V, vec3 L, float roughness){
  return geometrySchlickGGX(max(dot(N,V),0.0), roughness)
       * geometrySchlickGGX(max(dot(N,L),0.0), roughness);
}

vec3 fresnelSchlick(float cosTheta, vec3 F0){
  return F0 + (1.0 - F0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

void main(){
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);

  vec3 F0 = vec3(1.0, 0.766, 0.336);
  vec3 albedo = vec3(1.0, 0.843, 0.0);
  float metallic = 1.0;
  float roughness = 0.18;

  float dispNorm = smoothstep(-0.5, 0.5, vDisp);
  roughness = mix(0.28, 0.12, dispNorm);
  vec3 goldDeep = vec3(0.55, 0.35, 0.05);
  vec3 goldBright = vec3(1.0, 0.84, 0.0);
  albedo = mix(goldDeep, goldBright, dispNorm);

  vec3 lights[5];
  vec3 lightColors[5];
  lights[0] = normalize(vec3( 4.0, 5.0, 6.0));  lightColors[0] = vec3(1.0, 0.95, 0.85) * 3.0;
  lights[1] = normalize(vec3(-5.0, 3.0,-2.0));   lightColors[1] = vec3(1.0, 0.90, 0.75) * 1.8;
  lights[2] = normalize(vec3( 0.0,-4.0, 5.0));   lightColors[2] = vec3(0.95, 0.85, 0.70) * 1.2;
  lights[3] = normalize(vec3( 2.0, 6.0,-1.0));   lightColors[3] = vec3(1.0, 0.97, 0.90) * 2.0;
  lights[4] = normalize(vec3(-2.0,-1.0, 4.0));   lightColors[4] = vec3(1.0, 0.88, 0.65) * 0.8;

  vec3 Lo = vec3(0.0);
  for(int i = 0; i < 5; i++){
    vec3 L = lights[i];
    vec3 H = normalize(V + L);
    float NdL = max(dot(N, L), 0.0);

    float D = distributionGGX(N, H, roughness);
    float G = geometrySmith(N, V, L, roughness);
    vec3  F = fresnelSchlick(max(dot(H, V), 0.0), F0);

    vec3 numerator = D * G * F;
    float denominator = 4.0 * max(dot(N, V), 0.0) * NdL + 0.0001;
    vec3 specular = numerator / denominator;

    vec3 kD = (vec3(1.0) - F) * (1.0 - metallic);
    Lo += (kD * albedo / 3.14159265 + specular) * lightColors[i] * NdL;
  }

  vec3 R = reflect(-V, N);
  float envN = snoise(R * 2.5 + uTime * 0.08) * 0.5 + 0.5;
  vec3 envColor = mix(vec3(0.45, 0.30, 0.05), vec3(1.0, 0.85, 0.3), envN);
  vec3 F_env = fresnelSchlick(max(dot(N, V), 0.0), F0);
  vec3 ambient = envColor * F_env * 0.35;

  float concavity = smoothstep(-0.45, 0.1, vDisp);
  float darken = mix(0.08, 1.0, concavity);

  vec3 color = (ambient + Lo) * darken;

  float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
  float bloomMask = smoothstep(1.2, 2.5, luminance);
  color += color * bloomMask * 0.6;

  vec3 x = color;
  float a = 2.51; float b = 0.03; float c = 2.43; float d = 0.59; float e = 0.14;
  color = clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
  color = pow(color, vec3(1.0/2.2));

  gl_FragColor = vec4(color, 1.0);
}
`;

const BLOOM_EXTRACT_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uThreshold;
varying vec2 vUv;
void main(){
  vec4 c = texture2D(tDiffuse, vUv);
  float lum = dot(c.rgb, vec3(0.2126,0.7152,0.0722));
  gl_FragColor = lum > uThreshold ? c : vec4(0.0);
}
`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uDirection;
uniform vec2 uResolution;
varying vec2 vUv;
void main(){
  vec2 texelSize = 1.0 / uResolution;
  float weights[5];
  weights[0]=0.227027;weights[1]=0.1945946;weights[2]=0.1216216;weights[3]=0.054054;weights[4]=0.016216;
  vec3 result = texture2D(tDiffuse, vUv).rgb * weights[0];
  for(int i=1;i<5;i++){
    vec2 off = uDirection * texelSize * float(i) * 2.0;
    result += texture2D(tDiffuse, vUv + off).rgb * weights[i];
    result += texture2D(tDiffuse, vUv - off).rgb * weights[i];
  }
  gl_FragColor = vec4(result, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloomStrength;
varying vec2 vUv;
void main(){
  vec3 scene = texture2D(tScene, vUv).rgb;
  vec3 bloom = texture2D(tBloom, vUv).rgb;
  gl_FragColor = vec4(scene + bloom * uBloomStrength, 1.0);
}
`;

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}
`;

function createFullscreenQuad(material: THREE.ShaderMaterial) {
  const geo = new THREE.PlaneGeometry(2, 2);
  return new THREE.Mesh(geo, material);
}

export type NovaOrbProps = {
  state?: "speaking" | "listening" | "idle";
  className?: string;
  style?: React.CSSProperties;
};

export default function NovaOrb({ state = "idle", className, style }: NovaOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const W = rect.width || 300;
    const H = rect.height || 300;
    const dpr = Math.min(window.devicePixelRatio, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 1);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.1, 100);
    camera.position.set(0, 0, 4.0);

    const geometry = new THREE.IcosahedronGeometry(1.25, 200);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: 0.40 },
      },
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const sceneRT = new THREE.WebGLRenderTarget(W * dpr, H * dpr, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat, type: THREE.HalfFloatType,
    });
    const bloomRT1 = new THREE.WebGLRenderTarget(W * dpr * 0.5, H * dpr * 0.5, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });
    const bloomRT2 = new THREE.WebGLRenderTarget(W * dpr * 0.5, H * dpr * 0.5, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    });

    const postScene = new THREE.Scene();
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const extractMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLOOM_EXTRACT_FRAG,
      uniforms: { tDiffuse: { value: null }, uThreshold: { value: 0.9 } },
    });
    const blurMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: {
        tDiffuse: { value: null },
        uDirection: { value: new THREE.Vector2(1, 0) },
        uResolution: { value: new THREE.Vector2(W * dpr * 0.5, H * dpr * 0.5) },
      },
    });
    const compositeMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        uBloomStrength: { value: 0.7 },
      },
    });

    const fsQuad = createFullscreenQuad(extractMat);
    postScene.add(fsQuad);

    const mouse = { x: 0, y: 0, sx: 0, sy: 0, pvx: 0, pvy: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", onMove);

    const onResize = () => {
      const r = container.getBoundingClientRect();
      const w = r.width || 300;
      const h = r.height || 300;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const d = Math.min(window.devicePixelRatio, 2);
      sceneRT.setSize(w * d, h * d);
      bloomRT1.setSize(w * d * 0.5, h * d * 0.5);
      bloomRT2.setSize(w * d * 0.5, h * d * 0.5);
      blurMat.uniforms.uResolution.value.set(w * d * 0.5, h * d * 0.5);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let targetAmp = 0.40;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const dt = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      const s = stateRef.current;
      targetAmp = s === "speaking" ? 0.60 : s === "listening" ? 0.45 : 0.40;

      mouse.sx += (mouse.x - mouse.sx) * 0.04;
      mouse.sy += (mouse.y - mouse.sy) * 0.04;
      const vx = mouse.sx - mouse.pvx;
      const vy = mouse.sy - mouse.pvy;
      mouse.pvx = mouse.sx;
      mouse.pvy = mouse.sy;
      const vel = Math.sqrt(vx * vx + vy * vy);

      const ampTarget = targetAmp + Math.min(vel * 15, 0.25);
      material.uniforms.uAmplitude.value += (ampTarget - material.uniforms.uAmplitude.value) * 0.035;
      material.uniforms.uTime.value = elapsed;

      mesh.rotation.y += (mouse.sx * 0.5 - mesh.rotation.y) * 0.025;
      mesh.rotation.x += (-mouse.sy * 0.35 - mesh.rotation.x) * 0.025;
      mesh.rotation.y += dt * 0.06;

      renderer.setRenderTarget(sceneRT);
      renderer.clear();
      renderer.render(scene, camera);

      fsQuad.material = extractMat;
      extractMat.uniforms.tDiffuse.value = sceneRT.texture;
      renderer.setRenderTarget(bloomRT1);
      renderer.clear();
      renderer.render(postScene, postCamera);

      fsQuad.material = blurMat;
      blurMat.uniforms.tDiffuse.value = bloomRT1.texture;
      blurMat.uniforms.uDirection.value.set(1, 0);
      renderer.setRenderTarget(bloomRT2);
      renderer.clear();
      renderer.render(postScene, postCamera);

      blurMat.uniforms.tDiffuse.value = bloomRT2.texture;
      blurMat.uniforms.uDirection.value.set(0, 1);
      renderer.setRenderTarget(bloomRT1);
      renderer.clear();
      renderer.render(postScene, postCamera);

      blurMat.uniforms.tDiffuse.value = bloomRT1.texture;
      blurMat.uniforms.uDirection.value.set(1, 0);
      renderer.setRenderTarget(bloomRT2);
      renderer.clear();
      renderer.render(postScene, postCamera);

      blurMat.uniforms.tDiffuse.value = bloomRT2.texture;
      blurMat.uniforms.uDirection.value.set(0, 1);
      renderer.setRenderTarget(bloomRT1);
      renderer.clear();
      renderer.render(postScene, postCamera);

      fsQuad.material = compositeMat;
      compositeMat.uniforms.tScene.value = sceneRT.texture;
      compositeMat.uniforms.tBloom.value = bloomRT1.texture;
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(postScene, postCamera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("resize", onResize);
      geometry.dispose();
      material.dispose();
      sceneRT.dispose();
      bloomRT1.dispose();
      bloomRT2.dispose();
      extractMat.dispose();
      blurMat.dispose();
      compositeMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: 220,
        height: 220,
        background: "#000",
        borderRadius: "50%",
        overflow: "hidden",
        ...style,
      }}
    />
  );
}
