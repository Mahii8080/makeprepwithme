import React from 'react';

export type AvatarState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'happy' | 'serious' | 'confused' | 'encouraging' | 'speaking_o' | 'speaking_e' | 'speaking_m';

interface AvatarProps {
  state: AvatarState;
  sizeClassName?: string;
}

const FaceFeatures: React.FC<{ state: AvatarState }> = ({ state }) => {
    // A friendly, blue iris color that complements the app's theme
    const irisColor = "#63b3ed";

    // Default neutral state features
    let leftEyebrow = <path d="M 9 13 Q 13 11 17 13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
    let rightEyebrow = <path d="M 23 13 Q 27 11 31 13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
    
    let leftEyeShape = <path d="M 9 18 C 11 15, 15 15, 17 18 C 15 21, 11 21, 9 18 Z" fill="white" />;
    let rightEyeShape = <path d="M 23 18 C 25 15, 29 15, 31 18 C 29 21, 25 21, 23 18 Z" fill="white" />;
    
    let leftPupilCx = 13;
    let rightPupilCx = 27;
    let pupilCy = 18;

    let mouth = <path d="M17 28 Q 20 29 23 28" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;

    switch (state) {
        case 'speaking': // 'ah' sound
            mouth = <ellipse cx="20" cy="29" rx="4" ry="3.5" fill="#1a202c" />;
            break;
        case 'speaking_o': // 'oh' sound
             mouth = <ellipse cx="20" cy="29" rx="2.5" ry="3" fill="#1a202c" />;
            break;
        case 'speaking_e': // 'ee' sound, showing teeth
            mouth = <>
                <path d="M16 29 C 20 28, 20 28, 24 29" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                <rect x="17" y="28.5" width="6" height="1" fill="white" />
            </>;
            break;
        case 'speaking_m': // 'm', 'p', 'b' sounds
            mouth = <path d="M17 29 H 23" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            break;
        
        case 'thinking':
            leftPupilCx = 11;
            rightPupilCx = 25;
            pupilCy = 17;
            leftEyebrow = <path d="M 9 12 Q 13 10 17 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            rightEyebrow = <path d="M 23 12 Q 27 10 31 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            mouth = <path d="M18 28.5 H 22" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            break;

        case 'happy':
        case 'encouraging':
            leftEyebrow = <path d="M 9 14 Q 13 10 17 14" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            rightEyebrow = <path d="M 23 14 Q 27 10 31 14" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            // Smile-squint eyes
            leftEyeShape = <path d="M9 19 C12 17, 15 17, 17 19" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>;
            rightEyeShape = <path d="M23 19 C26 17, 29 17, 31 19" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/>;
            mouth = <path d={state === 'happy' ? "M15 28 Q20 33, 25 28" : "M16 28 Q20 31, 24 28"} stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            break;

        case 'serious':
            leftEyebrow = <path d="M 9 12 L 17 13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            rightEyebrow = <path d="M 23 13 L 31 12" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            mouth = <path d="M17 29 H 23" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            break;

        case 'confused':
            leftEyebrow = <path d="M 9 12 L 17 13" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />; // one down
            rightEyebrow = <path d="M 23 14 Q 27 10 31 14" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />; // one raised
            mouth = <path d="M18 29 C 19 27, 21 27, 22 29" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
            break;

        case 'idle':
        case 'listening':
        default:
             // Neutral expression, already set by default
            break;
    }

    const nose = <path d="M20 23 C 19 25, 21 25, 20 23" stroke="currentColor" strokeOpacity="0.6" strokeWidth="1" fill="none" strokeLinecap="round" />;

    return (
        <g className="text-white transition-all duration-300 ease-in-out">
            {/* Eyebrows */}
            <g className="transition-transform duration-300">
                {leftEyebrow}
                {rightEyebrow}
            </g>

            {/* Eyes */}
            {leftEyeShape}
            {rightEyeShape}
            
            {/* Pupils are not drawn for squinting eyes */}
            {(state !== 'happy' && state !== 'encouraging') && (
                <>
                    <circle cx={leftPupilCx} cy={pupilCy} r="2.5" fill={irisColor} className="transition-all duration-300"/>
                    <circle cx={rightPupilCx} cy={pupilCy} r="2.5" fill={irisColor} className="transition-all duration-300"/>
                    <circle cx={leftPupilCx} cy={pupilCy} r="1.5" fill="#1a202c" className="transition-all duration-300"/>
                    <circle cx={rightPupilCx} cy={pupilCy} r="1.5" fill="#1a202c" className="transition-all duration-300"/>
                </>
            )}

            {/* Nose */}
            {nose}

            {/* Mouth with a faster transition for lip-sync */}
            <g className="transition-all duration-75 ease-out">
                {mouth}
            </g>
        </g>
    );
};


export const Avatar: React.FC<AvatarProps> = ({ state, sizeClassName = "w-48 h-48" }) => {
  return (
    <div className={`${sizeClassName} rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30`}>
        <svg viewBox="0 0 40 40" className="w-full h-full p-2">
           <FaceFeatures state={state} />
        </svg>
    </div>
  );
};
