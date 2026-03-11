
import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, Cylinder, Box, Float, PerspectiveCamera, OrbitControls, ContactShadows, Gltf } from '@react-three/drei';
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
  const leftEyeRef = useRef<THREE.Group>(null);
  const rightEyeRef = useRef<THREE.Group>(null);
  const leftEyebrowRef = useRef<THREE.Group>(null);
  const rightEyebrowRef = useRef<THREE.Group>(null);

  // Material colors - Memoji Style Palette
  const skinColor = "#e0ac69";
  const jacketColor = "#fca311"; // Yellow-Orange Hoodie
  const eyeColor = "#1a1a1a";
  const hairColor = "#1a1a1a"; // Black Hair and Beard
  const lipColor = "#c97a55";
  const catchlightColor = "#ffffff";
  const neonBlue = "#00d4ff"; // Glowing Blue for UI/Desk
  const glassesColor = "#000000"; // Thick Black Glasses
  const deskColor = "#2a2a2a"; // Graphite Desk
  const chairColor = "#1a1a1a";

  // Animation targets (Goal rotations/positions)
  const targets = useMemo(() => {
    const base = {
      lArm: new THREE.Euler(0, 0, 0.2),
      rArm: new THREE.Euler(0, 0, -0.2),
      head: new THREE.Euler(0, 0, 0),
      mouthScale: new THREE.Vector3(1, 0.1, 1),
      eyebrowsY: 0.24,
      eyebrowsRot: 0,
    };

    switch (state) {
      case 'speaking':
      case 'speaking_o':
      case 'speaking_e':
      case 'speaking_m':
        return {
          ...base,
          lArm: new THREE.Euler(0.25, 0.05, 0.25),
          rArm: new THREE.Euler(0.15, -0.05, -0.25),
          mouthScale: new THREE.Vector3(1.1, state === 'speaking' ? 0.8 : 0.4, 1),
          eyebrowsY: 0.25,
        };
      case 'thinking':
        return {
          ...base,
          head: new THREE.Euler(-0.08, 0.15, 0.02),
          rArm: new THREE.Euler(1.1, -0.2, -0.6),
          lArm: new THREE.Euler(0.08, 0, 0.15),
          eyebrowsY: 0.21,
          eyebrowsRot: 0.04,
        };
      case 'happy':
      case 'encouraging':
        return {
          ...base,
          lArm: new THREE.Euler(0.4, 0.08, 0.18),
          rArm: new THREE.Euler(0.4, -0.08, -0.18),
          mouthScale: new THREE.Vector3(1.3, 0.45, 1),
          eyebrowsY: 0.26,
        };
      case 'serious':
        return {
          ...base,
          head: new THREE.Euler(0.04, 0, 0),
          eyebrowsY: 0.22,
          eyebrowsRot: -0.04,
        };
      case 'confused':
        return {
          ...base,
          head: new THREE.Euler(-0.08, 0, 0.12),
          lArm: new THREE.Euler(0.7, 0.2, 0.15),
          rArm: new THREE.Euler(0.7, -0.2, -0.15),
          eyebrowsRot: 0.07,
        };
      case 'listening':
        return {
          ...base,
          head: new THREE.Euler(0.04, -0.08, 0.02),
          lArm: new THREE.Euler(0, 0, 0.2),
        };
      default:
        return base;
    }
  }, [state]);

  useFrame((clockState) => {
    const t = clockState.clock.getElapsedTime();
    const lerpSpeed = 0.08;

    if (headRef.current) {
      headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, targets.head.x + Math.sin(t * 0.4) * 0.012, lerpSpeed);
      headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, targets.head.y, lerpSpeed);
      headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, targets.head.z, lerpSpeed);
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = THREE.MathUtils.lerp(leftArmRef.current.rotation.x, targets.lArm.x + Math.cos(t * 1.2) * 0.03, lerpSpeed);
      leftArmRef.current.rotation.z = THREE.MathUtils.lerp(leftArmRef.current.rotation.z, targets.lArm.z, lerpSpeed);
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = THREE.MathUtils.lerp(rightArmRef.current.rotation.x, targets.rArm.x + Math.sin(t * 1.2) * 0.03, lerpSpeed);
      rightArmRef.current.rotation.z = THREE.MathUtils.lerp(rightArmRef.current.rotation.z, targets.rArm.z, lerpSpeed);
    }

    if (mouthRef.current) {
      mouthRef.current.scale.y = THREE.MathUtils.lerp(mouthRef.current.scale.y, targets.mouthScale.y, 0.18);
      mouthRef.current.scale.x = THREE.MathUtils.lerp(mouthRef.current.scale.x, targets.mouthScale.x, 0.18);
    }

    if (leftEyebrowRef.current && rightEyebrowRef.current) {
      leftEyebrowRef.current.position.y = THREE.MathUtils.lerp(leftEyebrowRef.current.position.y, targets.eyebrowsY, lerpSpeed);
      leftEyebrowRef.current.rotation.z = THREE.MathUtils.lerp(leftEyebrowRef.current.rotation.z, targets.eyebrowsRot, lerpSpeed);
      rightEyebrowRef.current.position.y = THREE.MathUtils.lerp(rightEyebrowRef.current.position.y, targets.eyebrowsY, lerpSpeed);
      rightEyebrowRef.current.rotation.z = THREE.MathUtils.lerp(rightEyebrowRef.current.rotation.z, -targets.eyebrowsRot, lerpSpeed);
    }

    if (leftEyeRef.current && rightEyeRef.current) {
      const blink = Math.sin(t * 5.5) > 0.988 ? 0.05 : 1;
      leftEyeRef.current.scale.y = THREE.MathUtils.lerp(leftEyeRef.current.scale.y, blink, 0.5);
      rightEyeRef.current.scale.y = THREE.MathUtils.lerp(rightEyeRef.current.scale.y, blink, 0.5);
    }
  });

  return (
    <group position={[0, -1.8, 0]}>

      {/* Torso - Yellow-Orange Hoodie */}
      <group position={[0, 1.1, 0]}>
        {/* Main Chest/Shoulder Block */}
        <Box args={[1.3, 0.9, 0.7]} position={[0, 0.35, 0]} castShadow>
          <meshStandardMaterial color={jacketColor} roughness={0.8} />
        </Box>
        <Box args={[1.1, 0.7, 0.6]} position={[0, -0.15, 0]} castShadow>
          <meshStandardMaterial color={jacketColor} roughness={0.8} />
        </Box>
      </group>

      {/* Neck & Anatomy */}
      <group position={[0, 1.9, 0]}>
        <Cylinder args={[0.11, 0.14, 0.45]} castShadow>
          <meshStandardMaterial color={skinColor} />
        </Cylinder>
        {/* Hoodie Collar */}
        <Cylinder args={[0.2, 0.25, 0.2]} position={[0, -0.15, 0]}>
          <meshStandardMaterial color={jacketColor} roughness={0.8} />
        </Cylinder>
      </group>

      {/* Head Group - Anatomical Refinement */}
      <group ref={headRef} position={[0, 2.55, 0.05]}>
        {/* Brain Case */}
        <Sphere args={[0.42, 32, 24]} position={[0, 0.05, -0.05]}>
          <meshStandardMaterial color={skinColor} roughness={0.7} />
        </Sphere>
        {/* Face Plane */}
        <Sphere args={[0.4, 32, 24]} position={[0, 0, 0.05]} scale={[0.95, 1.05, 1]}>
          <meshStandardMaterial color={skinColor} />
        </Sphere>
        {/* Jawline & Chin */}
        <group position={[0, -0.15, 0.05]}>
          <Box args={[0.35, 0.3, 0.4]} rotation={[0.4, 0, 0]} position={[0, -0.1, -0.1]}>
            <meshStandardMaterial color={skinColor} />
          </Box>
          <Sphere args={[0.15, 16, 16]} position={[0, -0.22, 0.1]} scale={[1, 0.6, 1]}>
            <meshStandardMaterial color={skinColor} />
          </Sphere>
        </group>

        {/* Ears */}
        <Sphere args={[0.08, 16, 16]} position={[-0.43, 0, -0.05]} scale={[0.5, 1, 0.8]}>
          <meshStandardMaterial color={skinColor} />
        </Sphere>
        <Sphere args={[0.08, 16, 16]} position={[0.43, 0, -0.05]} scale={[0.5, 1, 0.8]}>
          <meshStandardMaterial color={skinColor} />
        </Sphere>

        {/* Glasses - Thick Black Frames */}
        <group position={[0, 0.1, 0.47]}>
          {/* Left Frame */}
          <group position={[-0.15, 0.0, 0.0]}>
            <Box args={[0.17, 0.04, 0.02]} position={[0, 0.08, 0]}><meshStandardMaterial color={glassesColor} /></Box>
            <Box args={[0.17, 0.04, 0.02]} position={[0, -0.08, 0]}><meshStandardMaterial color={glassesColor} /></Box>
            <Box args={[0.04, 0.16, 0.02]} position={[-0.085, 0, 0]}><meshStandardMaterial color={glassesColor} /></Box>
            <Box args={[0.04, 0.16, 0.02]} position={[0.085, 0, 0]}><meshStandardMaterial color={glassesColor} /></Box>
          </group>
          {/* Right Frame */}
          <group position={[0.15, 0.0, 0.0]}>
            <Box args={[0.17, 0.04, 0.02]} position={[0, 0.08, 0]}><meshStandardMaterial color={glassesColor} /></Box>
            <Box args={[0.17, 0.04, 0.02]} position={[0, -0.08, 0]}><meshStandardMaterial color={glassesColor} /></Box>
            <Box args={[0.04, 0.16, 0.02]} position={[-0.085, 0, 0]}><meshStandardMaterial color={glassesColor} /></Box>
            <Box args={[0.04, 0.16, 0.02]} position={[0.085, 0, 0]}><meshStandardMaterial color={glassesColor} /></Box>
          </group>
          {/* Bridge */}
          <Box args={[0.1, 0.04, 0.02]} position={[0, 0.05, 0]}><meshStandardMaterial color={glassesColor} /></Box>
          {/* Arms */}
          <Box args={[0.03, 0.02, 0.5]} position={[-0.26, 0.05, -0.2]} rotation={[0, -0.1, 0]}><meshStandardMaterial color={glassesColor} /></Box>
          <Box args={[0.03, 0.02, 0.5]} position={[0.26, 0.05, -0.2]} rotation={[0, 0.1, 0]}><meshStandardMaterial color={glassesColor} /></Box>
        </group>

        {/* Facial Features */}
        <group position={[0, 0.05, 0.38]}>
          {/* Eyes */}
          <group ref={leftEyeRef} position={[-0.15, 0.08, 0.05]}>
            <Sphere args={[0.065, 16, 16]}>
              <meshBasicMaterial color="white" />
            </Sphere>
            <Sphere args={[0.04, 16, 16]} position={[0, 0, 0.025]}>
              <meshBasicMaterial color="#7dd3fc" />
            </Sphere>
            <Sphere args={[0.02, 16, 16]} position={[0, 0, 0.035]}>
              <meshBasicMaterial color={eyeColor} />
            </Sphere>
            <Sphere args={[0.015, 8, 8]} position={[0.015, 0.015, 0.07]}>
              <meshBasicMaterial color={catchlightColor} />
            </Sphere>
          </group>
          <group ref={rightEyeRef} position={[0.15, 0.08, 0.05]}>
            <Sphere args={[0.065, 16, 16]}>
              <meshBasicMaterial color="white" />
            </Sphere>
            <Sphere args={[0.04, 16, 16]} position={[0, 0, 0.025]}>
              <meshBasicMaterial color="#7dd3fc" />
            </Sphere>
            <Sphere args={[0.02, 16, 16]} position={[0, 0, 0.035]}>
              <meshBasicMaterial color={eyeColor} />
            </Sphere>
            <Sphere args={[0.015, 8, 8]} position={[0.015, 0.015, 0.07]}>
              <meshBasicMaterial color={catchlightColor} />
            </Sphere>
          </group>

          {/* Eyebrows */}
          <group ref={leftEyebrowRef} position={[-0.15, 0.22, 0.05]}>
            <Box args={[0.12, 0.02, 0.03]} rotation={[0, 0, 0.1]}>
              <meshBasicMaterial color={hairColor} />
            </Box>
          </group>
          <group ref={rightEyebrowRef} position={[0.15, 0.22, 0.05]}>
            <Box args={[0.12, 0.02, 0.03]} rotation={[0, 0, -0.1]}>
              <meshBasicMaterial color={hairColor} />
            </Box>
          </group>

          {/* Nose - More defined */}
          <group position={[0, -0.05, 0.05]}>
            <Box args={[0.05, 0.15, 0.1]} rotation={[0.2, 0, 0]}>
              <meshStandardMaterial color={skinColor} />
            </Box>
            <Sphere args={[0.04, 8, 8]} position={[0, -0.08, 0.05]}>
              <meshStandardMaterial color={skinColor} />
            </Sphere>
          </group>

          {/* Mouth */}
          <group position={[0, -0.22, 0.05]}>
            <Box ref={mouthRef} args={[0.18, 0.04, 0.02]}>
              <meshStandardMaterial color={lipColor} />
            </Box>
          </group>
        </group>

        {/* Hair - Simple Clean Cut */}
        <group position={[0, 0.25, -0.05]}>
          {/* Main Hair Mass */}
          <Sphere args={[0.42, 32, 32]} scale={[1.02, 0.85, 1.1]} position={[0, 0.05, 0]}>
            <meshStandardMaterial color={hairColor} roughness={0.9} />
          </Sphere>
          {/* Slight top parting volume */}
          <Sphere args={[0.35, 24, 24]} scale={[1.0, 0.5, 1.1]} position={[0, 0.28, 0.1]}>
            <meshStandardMaterial color={hairColor} roughness={0.9} />
          </Sphere>
          {/* Sideburns */}
          <Box args={[0.08, 0.15, 0.08]} position={[-0.4, -0.15, 0.15]} rotation={[0, 0, -0.1]}>
            <meshStandardMaterial color={hairColor} roughness={0.9} />
          </Box>
          <Box args={[0.08, 0.15, 0.08]} position={[0.4, -0.15, 0.15]} rotation={[0, 0, 0.1]}>
            <meshStandardMaterial color={hairColor} roughness={0.9} />
          </Box>
        </group>


      </group>

      {/* Arms - Multi-segment for better pose */}
      <group ref={leftArmRef} position={[-0.6, 1.8, 0]}>
        {/* Upper Arm Only */}
        <Cylinder args={[0.12, 0.11, 0.6]} position={[0, -0.25, 0]} rotation={[0, 0, 0.1]}>
          <meshStandardMaterial color={jacketColor} />
        </Cylinder>
      </group>

      <group ref={rightArmRef} position={[0.6, 1.8, 0]}>
        {/* Upper Arm Only */}
        <Cylinder args={[0.12, 0.11, 0.6]} position={[0, -0.25, 0]} rotation={[0, 0, -0.1]}>
          <meshStandardMaterial color={jacketColor} />
        </Cylinder>
      </group>

    </group>
  );
};

export const ThreeAvatar: React.FC<ThreeAvatarProps> = ({ state }) => {
  return (
    <div className="w-full h-full min-h-[150px] md:min-h-[400px] cursor-pointer">
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0.8, 3.5]} fov={40} />

        <ambientLight intensity={0.5} />
        <pointLight position={[5, 5, 5]} intensity={1.2} castShadow />
        <spotLight position={[-5, 5, -5]} angle={0.2} penumbra={1} intensity={0.8} />
        <hemisphereLight intensity={0.6} groundColor="#111111" color="#ffffff" />

        <directionalLight
          position={[0, 2, 5]}
          intensity={0.4}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />

        <HumanoidModel state={state} />

        <ContactShadows
          position={[0, -1.8, 0]}
          opacity={0.3}
          scale={10}
          blur={2.5}
          far={4}
        />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          target={[0, 0.5, 0]}
          minPolarAngle={Math.PI / 2.5}
          maxPolarAngle={Math.PI / 1.8}
          minAzimuthAngle={-Math.PI / 12}
          maxAzimuthAngle={Math.PI / 12}
        />
      </Canvas>
    </div>
  );
};
