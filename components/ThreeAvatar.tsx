
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, Cylinder, Box, PerspectiveCamera, OrbitControls, ContactShadows, Float } from '@react-three/drei';
import * as THREE from 'three';
import { AvatarState } from './Avatar';

interface ThreeAvatarProps {
  state: AvatarState;
}

const HumanoidModel: React.FC<{ state: AvatarState }> = ({ state }) => {
  const headRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const teethRef = useRef<THREE.Mesh>(null);
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);
  const leftEyebrowRef = useRef<THREE.Group>(null);
  const rightEyebrowRef = useRef<THREE.Group>(null);

  // Professional Palette - Executive Look
  const skinColor = "#dfb598";
  const suitColor = "#1e293b"; // Slate 800 - Navy/Charcoal
  const shirtColor = "#ffffff";
  const tieColor = "#991b1b"; // Dark Red
  const eyeColor = "#1a1a1a";
  const hairColor = "#2d2d2d"; // Dark Espresso
  const lipColor = "#b3765e";
  const catchlightColor = "#ffffff";

  // Animation targets
  const targets = useMemo(() => {
    const base = {
      lArmX: 0,
      lArmZ: 0.15,
      rArmX: 0,
      rArmZ: -0.15,
      headX: 0,
      headY: 0,
      mouthScaleY: 0.05,
      mouthScaleX: 1,
      eyebrowsY: 0.23,
      eyebrowsRot: 0,
      eyeScaleY: 1,
    };

    switch (state) {
      case 'speaking':
      case 'speaking_o':
      case 'speaking_e':
      case 'speaking_m':
        return {
          ...base,
          headX: 0.02,
          mouthScaleY: state === 'speaking' ? 0.7 : state === 'speaking_o' ? 0.4 : 0.2,
          mouthScaleX: state === 'speaking_o' ? 0.8 : 1.1,
          eyebrowsY: 0.24,
        };
      case 'thinking':
        return {
          ...base,
          headX: -0.05,
          headY: 0.15,
          rArmX: 0.8,
          rArmZ: -0.4,
          eyebrowsY: 0.21,
          eyebrowsRot: 0.05,
        };
      case 'happy':
      case 'encouraging':
        return {
          ...base,
          mouthScaleY: 0.15,
          mouthScaleX: 1.3,
          eyebrowsY: 0.26,
          eyeScaleY: 0.7,
        };
      case 'serious':
        return {
          ...base,
          headX: 0.05,
          eyebrowsY: 0.21,
          eyebrowsRot: -0.05,
        };
      case 'confused':
        return {
          ...base,
          headY: -0.1,
          headX: -0.05,
          eyebrowsRot: 0.08,
          eyebrowsY: 0.23,
        };
      case 'listening':
        return {
          ...base,
          headX: 0.03,
          headY: -0.05,
        };
      default:
        return base;
    }
  }, [state]);

  useFrame((clockState) => {
    const t = clockState.clock.getElapsedTime();
    const lerpSpeed = 0.08;

    if (headRef.current) {
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targets.headX + Math.sin(t * 0.5) * 0.01, lerpSpeed);
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targets.headY + Math.cos(t * 0.3) * 0.015, lerpSpeed);
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, targets.lArmX + Math.cos(t * 1.5) * 0.02, lerpSpeed);
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, targets.lArmZ, lerpSpeed);
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, targets.rArmX + Math.sin(t * 1.5) * 0.02, lerpSpeed);
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, targets.rArmZ, lerpSpeed);
    }

    if (mouthRef.current) {
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, targets.mouthScaleY, 0.2);
      mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, targets.mouthScaleX, 0.2);
    }

    if (teethRef.current) {
      teethRef.current.scale.y = THREE.MathUtils.lerp(teethRef.current.scale.y, Math.max(0.1, targets.mouthScaleY * 0.5), 0.2);
    }

    if (leftEyebrowRef.current && rightEyebrowRef.current) {
      leftEyebrowRef.current.position.y = THREE.MathUtils.lerp(leftEyebrowRef.current.position.y, targets.eyebrowsY, lerpSpeed);
      leftEyebrowRef.current.rotation.z = THREE.MathUtils.lerp(leftEyebrowRef.current.rotation.z, targets.eyebrowsRot, lerpSpeed);
      rightEyebrowRef.current.position.y = THREE.MathUtils.lerp(rightEyebrowRef.current.position.y, targets.eyebrowsY, lerpSpeed);
      rightEyebrowRef.current.rotation.z = THREE.MathUtils.lerp(rightEyebrowRef.current.rotation.z, -targets.eyebrowsRot, lerpSpeed);
    }

    if (leftEyeRef.current && rightEyeRef.current) {
      const blink = Math.sin(t * 4) > 0.985 ? 0.02 : targets.eyeScaleY;
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, blink, 0.4);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, blink, 0.4);
    }
  });

  return (
    <group position={[0, -1.9, 0]}>
      
      {/* ── BODY: Professional Suit ── */}
      <group position={[0, 1.0, 0]}>
        {/* Suit Jacket - Main Torso */}
        <Box args={[1.3, 1.0, 0.6]} position={[0, 0.4, 0]} castShadow>
          <meshStandardMaterial color={suitColor} roughness={0.7} />
        </Box>
        {/* Suit Hips */}
        <Box args={[1.1, 0.8, 0.55]} position={[0, -0.3, 0]} castShadow>
          <meshStandardMaterial color={suitColor} roughness={0.7} />
        </Box>
        
        {/* Shirt V-neck insert */}
        <Box args={[0.3, 0.5, 0.1]} position={[0, 0.7, 0.31]}>
          <meshStandardMaterial color={shirtColor} />
        </Box>
        
        {/* Tie */}
        <Box args={[0.08, 0.5, 0.05]} position={[0, 0.4, 0.35]} rotation={[0.05, 0, 0]}>
          <meshStandardMaterial color={tieColor} metalness={0.2} roughness={0.5} />
        </Box>
        
        {/* Jacket Lapels */}
        <Box args={[0.25, 0.6, 0.1]} position={[-0.2, 0.6, 0.32]} rotation={[0, 0.2, -0.2]}>
          <meshStandardMaterial color={suitColor} />
        </Box>
        <Box args={[0.25, 0.6, 0.1]} position={[0.2, 0.6, 0.32]} rotation={[0, -0.2, 0.2]}>
          <meshStandardMaterial color={suitColor} />
        </Box>
      </group>

      {/* Neck */}
      <group position={[0, 1.95, 0]}>
        <Cylinder args={[0.13, 0.16, 0.4]} castShadow>
          <meshStandardMaterial color={skinColor} />
        </Cylinder>
        {/* Shirt Collar */}
        <group position={[0, -0.05, 0]}>
            <Cylinder args={[0.2, 0.22, 0.1]} rotation={[0.1, 0, 0]}>
                <meshStandardMaterial color={shirtColor} />
            </Cylinder>
        </group>
      </group>

      {/* ── HEAD: Refined Professional ── */}
      <group ref={headRef} position={[0, 2.6, 0.05]}>
        {/* Head Base */}
        <Sphere args={[0.4, 32, 24]} scale={[0.9, 1.05, 0.95]}>
          <meshStandardMaterial color={skinColor} roughness={0.6} />
        </Sphere>
        
        {/* Defined Jawline */}
        <Box args={[0.42, 0.3, 0.45]} position={[0, -0.15, -0.05]} rotation={[0.3, 0, 0]} scale={[0.8, 1, 1]}>
          <meshStandardMaterial color={skinColor} />
        </Box>

        {/* Professional Hairstyle - Refined Layers */}
        <group position={[0, 0.05, 0]}>
          {/* Main Hair Volume */}
          <Sphere args={[0.42, 32, 32]} scale={[1.02, 0.8, 1.1]} position={[0, 0.2, -0.05]}>
            <meshStandardMaterial color={hairColor} roughness={0.8} />
          </Sphere>
          {/* Top Volume / Style */}
          <Sphere args={[0.3, 16, 16]} scale={[1.1, 0.4, 1]} position={[0, 0.42, 0.05]}>
            <meshStandardMaterial color={hairColor} />
          </Sphere>
          {/* Side Hair */}
          <Box args={[0.1, 0.4, 0.4]} position={[-0.38, 0, 0]} rotation={[0, 0, 0.1]}>
             <meshStandardMaterial color={hairColor} />
          </Box>
          <Box args={[0.1, 0.4, 0.4]} position={[0.38, 0, 0]} rotation={[0, 0, -0.1]}>
             <meshStandardMaterial color={hairColor} />
          </Box>
        </group>

        {/* Sunglasses - Aviator Style with Gold Frame & Dark Tinted Lenses */}
        <group position={[0, 0.08, 0.38]}>
          {/* Temple arms - gold metallic */}
          <Box args={[0.38, 0.015, 0.015]} position={[-0.32, 0, -0.06]} rotation={[0, 0.15, 0]}>
            <meshStandardMaterial color="#c8a030" metalness={0.9} roughness={0.2} />
          </Box>
          <Box args={[0.38, 0.015, 0.015]} position={[0.32, 0, -0.06]} rotation={[0, -0.15, 0]}>
            <meshStandardMaterial color="#c8a030" metalness={0.9} roughness={0.2} />
          </Box>

          {/* Nose bridge - gold */}
          <Box args={[0.06, 0.02, 0.04]} position={[0, -0.01, 0.01]}>
            <meshStandardMaterial color="#c8a030" metalness={0.9} roughness={0.2} />
          </Box>

          {/* Left lens - dark tinted aviator shape */}
          <group position={[-0.155, 0, 0]}>
            {/* Lens fill - very dark tinted */}
            <Sphere args={[0.1, 32, 16]} scale={[1, 0.75, 0.18]}>
              <meshStandardMaterial color="#05051a" transparent opacity={0.92} metalness={0.3} roughness={0.1} />
            </Sphere>
            {/* Gold frame ring */}
            <Sphere args={[0.105, 32, 8]} scale={[1, 0.76, 0.12]}>
              <meshStandardMaterial color="#c8a030" metalness={0.9} roughness={0.2} wireframe={false} />
            </Sphere>
            {/* Lens top bar */}
            <Box args={[0.21, 0.018, 0.02]} position={[0, 0.075, 0]}>
              <meshStandardMaterial color="#c8a030" metalness={0.9} roughness={0.2} />
            </Box>
            {/* Shine highlight on lens */}
            <Sphere args={[0.055, 16, 8]} scale={[1, 0.5, 0.05]} position={[-0.02, 0.03, 0.09]}>
              <meshStandardMaterial color="#ffffff" transparent opacity={0.18} />
            </Sphere>
          </group>

          {/* Right lens - dark tinted aviator shape */}
          <group position={[0.155, 0, 0]}>
            {/* Lens fill - very dark tinted */}
            <Sphere args={[0.1, 32, 16]} scale={[1, 0.75, 0.18]}>
              <meshStandardMaterial color="#05051a" transparent opacity={0.92} metalness={0.3} roughness={0.1} />
            </Sphere>
            {/* Gold frame ring */}
            <Sphere args={[0.105, 32, 8]} scale={[1, 0.76, 0.12]}>
              <meshStandardMaterial color="#c8a030" metalness={0.9} roughness={0.2} />
            </Sphere>
            {/* Lens top bar */}
            <Box args={[0.21, 0.018, 0.02]} position={[0, 0.075, 0]}>
              <meshStandardMaterial color="#c8a030" metalness={0.9} roughness={0.2} />
            </Box>
            {/* Shine highlight on lens */}
            <Sphere args={[0.055, 16, 8]} scale={[1, 0.5, 0.05]} position={[0.02, 0.03, 0.09]}>
              <meshStandardMaterial color="#ffffff" transparent opacity={0.18} />
            </Sphere>
          </group>
        </group>

        {/* Facial Features */}
        <group position={[0, 0, 0.35]}>
          {/* Eyes */}
          <group ref={leftEyeRef} position={[-0.15, 0.1, 0.05]}>
            <Sphere args={[0.06, 16, 16]}><meshBasicMaterial color="white" /></Sphere>
            <Sphere args={[0.02, 16, 16]} position={[0, 0, 0.045]}><meshBasicMaterial color={eyeColor} /></Sphere>
            <Sphere args={[0.01, 8, 8]} position={[0.012, 0.012, 0.06]}><meshBasicMaterial color={catchlightColor} /></Sphere>
          </group>
          <group ref={rightEyeRef} position={[0.15, 0.1, 0.05]}>
            <Sphere args={[0.06, 16, 16]}><meshBasicMaterial color="white" /></Sphere>
            <Sphere args={[0.02, 16, 16]} position={[0, 0, 0.045]}><meshBasicMaterial color={eyeColor} /></Sphere>
            <Sphere args={[0.01, 8, 8]} position={[0.012, 0.012, 0.06]}><meshBasicMaterial color={catchlightColor} /></Sphere>
          </group>

          {/* Eyebrows */}
          <group ref={leftEyebrowRef} position={[-0.15, 0.23, 0.05]}><Box args={[0.13, 0.02, 0.02]}><meshBasicMaterial color={hairColor} /></Box></group>
          <group ref={rightEyebrowRef} position={[0.15, 0.23, 0.05]}><Box args={[0.13, 0.02, 0.02]}><meshBasicMaterial color={hairColor} /></Box></group>

          {/* Nose */}
          <Box args={[0.06, 0.14, 0.1]} position={[0, 0, 0.05]} rotation={[0.2, 0, 0]}><meshStandardMaterial color={skinColor} /></Box>

          {/* Mouth - Enhanced Lip Sync */}
          <group position={[0, -0.22, 0.05]}>
            <Box ref={mouthRef} args={[0.18, 0.06, 0.02]}>
              <meshStandardMaterial color={lipColor} roughness={0.8} />
            </Box>
            {/* Inner Mouth / Teeth */}
            <Box ref={teethRef} args={[0.15, 0.02, 0.01]} position={[0, 0, -0.01]}>
                <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={0.2} />
            </Box>
          </group>
        </group>
      </group>

      {/* Arms - Suit Sleeves */}
      <group ref={leftArmRef} position={[-0.65, 1.85, 0]}>
        <Cylinder args={[0.13, 0.11, 0.7]} position={[0, -0.3, 0]} rotation={[0, 0, 0.15]}>
          <meshStandardMaterial color={suitColor} />
        </Cylinder>
        {/* Hand */}
        <Sphere args={[0.08, 12, 12]} position={[-0.1, -0.65, 0.1]}>
           <meshStandardMaterial color={skinColor} />
        </Sphere>
      </group>

      <group ref={rightArmRef} position={[0.65, 1.85, 0]}>
        <Cylinder args={[0.13, 0.11, 0.7]} position={[0, -0.3, 0]} rotation={[0, 0, -0.15]}>
          <meshStandardMaterial color={suitColor} />
        </Cylinder>
        {/* Hand */}
        <Sphere args={[0.08, 12, 12]} position={[0.1, -0.65, 0.1]}>
           <meshStandardMaterial color={skinColor} />
        </Sphere>
      </group>

    </group>
  );
};

export const ThreeAvatar: React.FC<ThreeAvatarProps> = ({ state }) => {
  return (
    <div className="w-full h-full min-h-[400px]">
      <Canvas shadows dpr={[1, 2]} camera={{ position: [0, 0.8, 3.5], fov: 35 }}>
        <color attach="background" args={['#0f172a']} />
        
        {/* Cinematic Studio Lighting */}
        <ambientLight intensity={0.4} />
        <spotLight position={[5, 8, 5]} angle={0.3} penumbra={1} intensity={1.5} castShadow />
        <spotLight position={[-5, 5, 2]} angle={0.5} penumbra={1} intensity={0.8} color="#7dd3fc" />
        <pointLight position={[0, 2, -2]} intensity={0.5} color="#fff" />
        
        <Float speed={1.5} rotationIntensity={0.1} floatIntensity={0.2}>
          <HumanoidModel state={state} />
        </Float>

        <ContactShadows
          position={[0, -1.9, 0]}
          opacity={0.4}
          scale={12}
          blur={2.8}
          far={4}
        />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          target={[0, 0.6, 0]}
          minPolarAngle={Math.PI / 2.2}
          maxPolarAngle={Math.PI / 1.8}
          minAzimuthAngle={-Math.PI / 10}
          maxAzimuthAngle={Math.PI / 10}
        />
      </Canvas>
    </div>
  );
};
