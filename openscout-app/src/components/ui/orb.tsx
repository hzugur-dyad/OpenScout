"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type AgentState = null | "thinking" | "listening" | "speaking";

type OrbProps = {
  colors?: [string, string];
  colorsRef?: React.RefObject<[string, string]>;
  resizeDebounce?: number;
  seed?: number;
  agentState?: AgentState;
  volumeMode?: "auto" | "manual";
  manualInput?: number;
  manualOutput?: number;
  inputVolumeRef?: React.RefObject<number>;
  outputVolumeRef?: React.RefObject<number>;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
  className?: string;
};

type OrbVisualTargets = {
  input: number;
  output: number;
  speed: number;
  twist: number;
  rotation: number;
  spread: number;
  core: number;
  aura: number;
};

function readVolumeSource(
  value: number | undefined,
  ref?: React.RefObject<number>,
  getter?: () => number
) {
  if (value !== undefined) return clamp01(value);
  if (ref) return clamp01(ref.current ?? 0);
  if (getter) return clamp01(getter());
  return null;
}

function resolveOrbTargets(
  agentState: AgentState,
  time: number,
  liveInput: number | null,
  liveOutput: number | null
): OrbVisualTargets {
  if (agentState === "listening") {
    const level =
      liveInput ??
      clamp01(0.28 + Math.sin(time * 1.4) * 0.12 + Math.sin(time * 2.7 + 0.8) * 0.08);
    return {
      input: clamp01(0.16 + level * 0.74),
      output: clamp01(0.26 + level * 0.12),
      speed: 0.22 + level * 0.2,
      twist: 0.07 + level * 0.035,
      rotation: 0.56 + level * 0.18,
      spread: 1.08 + level * 0.08,
      core: 1.04 + level * 0.035,
      aura: 0.2 + level * 0.06,
    };
  }

  if (agentState === "thinking") {
    const flow = clamp01(0.42 + Math.sin(time * 0.7) * 0.08 + Math.sin(time * 1.9 + 1.1) * 0.04);
    return {
      input: flow,
      output: clamp01(0.38 + Math.sin(time * 0.9 + 0.6) * 0.08),
      speed: 0.38,
      twist: 0.16,
      rotation: 1.16,
      spread: 0.92,
      core: 0.985,
      aura: 0.17,
    };
  }

  if (agentState === "speaking") {
    const energy =
      liveOutput ??
      clamp01(0.56 + Math.sin(time * 4.1) * 0.18 + Math.sin(time * 7.3 + 0.5) * 0.12);
    return {
      input: clamp01(0.14 + energy * 0.12),
      output: clamp01(0.42 + energy * 0.58),
      speed: 0.48 + energy * 0.62,
      twist: 0.14 + energy * 0.18,
      rotation: 1.18 + energy * 0.52,
      spread: 1.06 + energy * 0.18,
      core: 1.04 + energy * 0.06,
      aura: 0.24 + energy * 0.14,
    };
  }

  return {
    input: 0.08,
    output: 0.28,
    speed: 0.18,
    twist: 0.05,
    rotation: 0.48,
    spread: 0.96,
    core: 1.0,
    aura: 0.16,
  };
}

export function Orb({
  colors = ["#CADCFC", "#A0B9D1"],
  colorsRef,
  resizeDebounce = 100,
  seed,
  agentState = null,
  volumeMode = "auto",
  manualInput,
  manualOutput,
  inputVolumeRef,
  outputVolumeRef,
  getInputVolume,
  getOutputVolume,
  className,
}: OrbProps) {
  return (
    <div className={`relative aspect-square w-full h-full ${className ?? ""}`.trim()} style={{ minHeight: 0, minWidth: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "transparent",
        }}
      >
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
          style={{ display: "block", width: "100%", height: "100%" }}
        >
          <Scene
          colors={colors}
          colorsRef={colorsRef}
          seed={seed}
          agentState={agentState}
          volumeMode={volumeMode}
          manualInput={manualInput}
          manualOutput={manualOutput}
          inputVolumeRef={inputVolumeRef}
          outputVolumeRef={outputVolumeRef}
          getInputVolume={getInputVolume}
          getOutputVolume={getOutputVolume}
        />
        </Canvas>
      </div>
    </div>
  );
}

function Scene({
  colors,
  colorsRef,
  seed,
  agentState,
  volumeMode,
  manualInput,
  manualOutput,
  inputVolumeRef,
  outputVolumeRef,
  getInputVolume,
  getOutputVolume,
}: {
  colors: [string, string];
  colorsRef?: React.RefObject<[string, string]>;
  seed?: number;
  agentState: AgentState;
  volumeMode: "auto" | "manual";
  manualInput?: number;
  manualOutput?: number;
  inputVolumeRef?: React.RefObject<number>;
  outputVolumeRef?: React.RefObject<number>;
  getInputVolume?: () => number;
  getOutputVolume?: () => number;
}) {
  const { gl } = useThree();
  const circleRef = useRef<THREE.Mesh>(null);
  const initialColorsRef = useRef<[string, string]>(colors);
  const targetColor1Ref = useRef(new THREE.Color(colors[0]));
  const targetColor2Ref = useRef(new THREE.Color(colors[1]));
  const animSpeedRef = useRef(0.1);
  const twistRef = useRef(0.05);
  const rotationRef = useRef(0.48);
  const spreadRef = useRef(0.96);
  const coreRef = useRef(1.0);
  const auraRef = useRef(0.16);
  const perlinNoiseTexture = useMemo(() => createNoiseTexture(), []);

  const agentRef = useRef<AgentState>(agentState);
  const modeRef = useRef<"auto" | "manual">(volumeMode);
  const manualInRef = useRef(manualInput ?? 0);
  const manualOutRef = useRef(manualOutput ?? 0);
  const curInRef = useRef(0);
  const curOutRef = useRef(0);

  useEffect(() => {
    agentRef.current = agentState;
  }, [agentState]);

  useEffect(() => {
    modeRef.current = volumeMode;
  }, [volumeMode]);

  useEffect(() => {
    manualInRef.current = clamp01(
      manualInput ?? inputVolumeRef?.current ?? getInputVolume?.() ?? 0
    );
  }, [manualInput, inputVolumeRef, getInputVolume]);

  useEffect(() => {
    manualOutRef.current = clamp01(
      manualOutput ?? outputVolumeRef?.current ?? getOutputVolume?.() ?? 0
    );
  }, [manualOutput, outputVolumeRef, getOutputVolume]);

  const random = useMemo(
    () => splitmix32(seed ?? Math.floor(Math.random() * 2 ** 32)),
    [seed]
  );
  const offsets = useMemo(
    () =>
      new Float32Array(Array.from({ length: 7 }, () => random() * Math.PI * 2)),
    [random]
  );

  useEffect(() => {
    targetColor1Ref.current = new THREE.Color(colors[0]);
    targetColor2Ref.current = new THREE.Color(colors[1]);
  }, [colors]);

  useEffect(() => {
    const apply = () => {
      if (!circleRef.current) return;
      const isDark = document.documentElement.classList.contains("dark");
      (circleRef.current.material as THREE.ShaderMaterial).uniforms.uInverted.value = isDark ? 1 : 0;
    };

    apply();

    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useFrame((_, delta: number) => {
    const mat = circleRef.current?.material as THREE.ShaderMaterial | undefined;
    if (!mat) return;
    const live = colorsRef?.current;
    if (live) {
      if (live[0]) targetColor1Ref.current.set(live[0]);
      if (live[1]) targetColor2Ref.current.set(live[1]);
    }
    const u = mat.uniforms as Record<string, { value: number | THREE.Color }>;
    u.uTime.value = (u.uTime.value as number) + delta * 0.5;

    const uOpacity = u.uOpacity.value as number;
    if (uOpacity < 1) {
      u.uOpacity.value = Math.min(1, uOpacity + delta * 2);
    }

    const liveInput =
      modeRef.current === "manual"
        ? readVolumeSource(manualInput, inputVolumeRef, getInputVolume)
        : null;
    const liveOutput =
      modeRef.current === "manual"
        ? readVolumeSource(manualOutput, outputVolumeRef, getOutputVolume)
        : null;
    const targets = resolveOrbTargets(
      agentRef.current,
      u.uTime.value as number,
      liveInput,
      liveOutput
    );

    curInRef.current += (targets.input - curInRef.current) * 0.18;
    curOutRef.current += (targets.output - curOutRef.current) * 0.18;

    animSpeedRef.current += (targets.speed - animSpeedRef.current) * 0.12;
    twistRef.current += (targets.twist - twistRef.current) * 0.12;
    rotationRef.current += (targets.rotation - rotationRef.current) * 0.12;
    spreadRef.current += (targets.spread - spreadRef.current) * 0.12;
    coreRef.current += (targets.core - coreRef.current) * 0.12;
    auraRef.current += (targets.aura - auraRef.current) * 0.12;

    u.uAnimation.value = (u.uAnimation.value as number) + delta * animSpeedRef.current;
    u.uInputVolume.value = curInRef.current;
    u.uOutputVolume.value = curOutRef.current;
    u.uTwist.value = twistRef.current;
    u.uRotationSpeed.value = rotationRef.current;
    u.uSpread.value = spreadRef.current;
    u.uCoreRadius.value = coreRef.current;
    u.uAuraStrength.value = auraRef.current;
    (u.uColor1.value as THREE.Color).lerp(targetColor1Ref.current, 0.08);
    (u.uColor2.value as THREE.Color).lerp(targetColor2Ref.current, 0.08);
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const onContextLost = (event: Event) => {
      event.preventDefault();
      setTimeout(() => {
        gl.forceContextRestore();
      }, 1);
    };
    canvas.addEventListener("webglcontextlost", onContextLost, false);
    return () =>
      canvas.removeEventListener("webglcontextlost", onContextLost, false);
  }, [gl]);

  const uniforms = useMemo(() => {
    perlinNoiseTexture.wrapS = THREE.RepeatWrapping;
    perlinNoiseTexture.wrapT = THREE.RepeatWrapping;
    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark");
    return {
      uColor1: new THREE.Uniform(new THREE.Color(initialColorsRef.current[0])),
      uColor2: new THREE.Uniform(new THREE.Color(initialColorsRef.current[1])),
      uOffsets: { value: offsets },
      uPerlinTexture: new THREE.Uniform(perlinNoiseTexture),
      uTime: new THREE.Uniform(0),
      uAnimation: new THREE.Uniform(0.1),
      uInverted: new THREE.Uniform(isDark ? 1 : 0),
      uInputVolume: new THREE.Uniform(0),
      uOutputVolume: new THREE.Uniform(0),
      uTwist: new THREE.Uniform(0.05),
      uRotationSpeed: new THREE.Uniform(0.48),
      uSpread: new THREE.Uniform(0.96),
      uCoreRadius: new THREE.Uniform(1.0),
      uAuraStrength: new THREE.Uniform(0.16),
      uOpacity: new THREE.Uniform(0),
    };
  }, [perlinNoiseTexture, offsets]);

  return (
    <mesh ref={circleRef}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

function createNoiseTexture(size = 128): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      // Cheap layered noise to mimic organic turbulence.
      const n1 = Math.random();
      const n2 = Math.random() * 0.5;
      const n3 = Math.random() * 0.25;
      const v = Math.max(0, Math.min(255, Math.floor((n1 + n2 + n3) / 1.75 * 255)));
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function splitmix32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x9e3779b9) | 0;
    let t = a ^ (a >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

const vertexShader = /* glsl */ `
uniform float uTime;
uniform sampler2D uPerlinTexture;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uAnimation;
uniform float uInverted;
uniform float uOffsets[7];
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uInputVolume;
uniform float uOutputVolume;
uniform float uTwist;
uniform float uRotationSpeed;
uniform float uSpread;
uniform float uCoreRadius;
uniform float uAuraStrength;
uniform float uOpacity;
uniform sampler2D uPerlinTexture;
varying vec2 vUv;

const float PI = 3.14159265358979323846;

bool drawOval(vec2 polarUv, vec2 polarCenter, float a, float b, bool reverseGradient, float softness, out vec4 color) {
  vec2 p = polarUv - polarCenter;
  float oval = (p.x * p.x) / (a * a) + (p.y * p.y) / (b * b);

  float edge = smoothstep(1.0, 1.0 - softness, oval);

  if (edge > 0.0) {
    float gradient = reverseGradient ? (1.0 - (p.x / a + 1.0) / 2.0) : ((p.x / a + 1.0) / 2.0);
    gradient = mix(0.5, gradient, 0.1);
    color = vec4(vec3(gradient), 0.85 * edge);
    return true;
  }
  return false;
}

vec3 colorRamp(float grayscale, vec3 color1, vec3 color2, vec3 color3, vec3 color4) {
  if (grayscale < 0.33) {
    return mix(color1, color2, grayscale * 3.0);
  } else if (grayscale < 0.66) {
    return mix(color2, color3, (grayscale - 0.33) * 3.0);
  } else {
    return mix(color3, color4, (grayscale - 0.66) * 3.0);
  }
}

vec2 hash2(vec2 p) {
  return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
}

float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  
  vec2 u = f * f * (3.0 - 2.0 * f);
  float n = mix(
    mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
    dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
    dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y
  );

  return 0.5 + 0.5 * n;
}

float sharpRing(vec3 decomposed, float time) {
  float ringStart = 1.0;
  float ringWidth = 0.3;
  float noiseScale = 5.0;

  float noise = mix(
    noise2D(vec2(decomposed.x, time) * noiseScale),
    noise2D(vec2(decomposed.y, time) * noiseScale),
    decomposed.z
  );

  noise = (noise - 0.5) * 2.5;

  return ringStart + noise * ringWidth * 1.5;
}

float smoothRing(vec3 decomposed, float time) {
  float ringStart = 0.9;
  float ringWidth = 0.2;
  float noiseScale = 6.0;

  float noise = mix(
    noise2D(vec2(decomposed.x, time) * noiseScale),
    noise2D(vec2(decomposed.y, time) * noiseScale),
    decomposed.z
  );

  noise = (noise - 0.5) * 5.0;

  return ringStart + noise * ringWidth;
}

float flow(vec3 decomposed, float time) {
  return mix(
    texture2D(uPerlinTexture, vec2(time, decomposed.x / 2.0)).r,
    texture2D(uPerlinTexture, vec2(time, decomposed.y / 2.0)).r,
    decomposed.z
  );
}

void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  float radius = length(uv);
  if (radius > 1.35) discard;

  float theta = atan(uv.y, uv.x);
  if (theta < 0.0) theta += 2.0 * PI;

  vec3 decomposed = vec3(
    theta / (2.0 * PI),
    mod(theta / (2.0 * PI) + 0.5, 1.0) + 1.0,
    abs(theta / PI - 1.0)
  );

  float statePhase = uTime * uRotationSpeed;
  float noise = flow(decomposed, radius * 0.03 - uAnimation * 0.2 - statePhase * 0.03) - 0.5;
  theta += noise * mix(0.06 + uTwist * 0.25, 0.18 + uTwist * 0.55, uOutputVolume);
  theta += sin(statePhase + radius * 6.0) * uTwist * 0.12;

  // Transparent base prevents a flat circular backing disk.
  vec4 color = vec4(0.0, 0.0, 0.0, 0.0);

  float originalCenters[7] = float[7](0.0, 0.5 * PI, 1.0 * PI, 1.5 * PI, 2.0 * PI, 2.5 * PI, 3.0 * PI);

  float centers[7];
  for (int i = 0; i < 7; i++) {
    centers[i] = originalCenters[i] + (0.22 + uTwist * 0.9) * sin(statePhase * 0.45 + uOffsets[i]);
  }

  float a, b;
  vec4 ovalColor;

  for (int i = 0; i < 7; i++) {
    float noise = texture2D(uPerlinTexture, vec2(mod(centers[i] + statePhase * 0.045, 1.0), 0.5)).r;
    a = (0.48 + noise * 0.28) * mix(0.94, 1.08, uSpread - 0.7);
    b = noise * mix(3.4 * uSpread, 2.35 * uSpread, uInputVolume);
    bool reverseGradient = (i % 2 == 1);

    float distTheta = min(
      abs(theta - centers[i]),
      min(
        abs(theta + 2.0 * PI - centers[i]),
        abs(theta - 2.0 * PI - centers[i])
      )
    );
    float distRadius = radius;

    float softness = mix(0.52, 0.68, clamp(uSpread - 0.85, 0.0, 1.0));

    if (drawOval(vec2(distTheta, distRadius), vec2(0.0, 0.0), a, b, reverseGradient, softness, ovalColor)) {
      color.rgb = mix(color.rgb, ovalColor.rgb, ovalColor.a);
      color.a = max(color.a, ovalColor.a);
    }
  }
  
  float ringRadius1 = sharpRing(decomposed, uTime * 0.1);
  float ringRadius2 = smoothRing(decomposed, uTime * 0.1);
  
  float inputRadius1 = radius + uInputVolume * 0.2;
  float inputRadius2 = radius + uInputVolume * 0.15;
  float opacity1 = mix(0.2, 0.6, uInputVolume);
  float opacity2 = mix(0.15, 0.45, uInputVolume);

  float ringAlpha1 = (inputRadius2 >= ringRadius1) ? opacity1 : 0.0;
  float ringAlpha2 = smoothstep(ringRadius2 - 0.05, ringRadius2 + 0.05, inputRadius1) * opacity2;
  
  float totalRingAlpha = max(ringAlpha1, ringAlpha2) * 0.0;
  
  vec3 ringColor = vec3(1.0);
  color.rgb = 1.0 - (1.0 - color.rgb) * (1.0 - ringColor * totalRingAlpha);

  vec3 color1 = vec3(0.0, 0.0, 0.0);
  vec3 color2 = uColor1;
  vec3 color3 = uColor2;
  // Avoid flat white disk by keeping the highlight in a warm-gold range.
  vec3 color4 = vec3(0.95, 0.84, 0.50);

  float luminance = mix(color.r, 1.0 - color.r, uInverted);
  color.rgb = colorRamp(luminance, color1, color2, color3, color4);

  // Let the page background bleed through the brightest zones a bit.
  float highlight = smoothstep(0.76, 0.98, luminance);
  color.a *= mix(1.0, 0.68 - min(uAuraStrength * 0.18, 0.12), highlight);

  // Soft core mask + atmospheric aura, no hard circular cutoff.
  float coreMask = 1.0 - smoothstep(0.72, uCoreRadius, radius);
  float auraMask = smoothstep(1.28, 0.62, radius);
  float softMask = max(coreMask, auraMask * uAuraStrength);

  color.a *= softMask;
  color.a *= uOpacity;

  gl_FragColor = color;
}
`;
