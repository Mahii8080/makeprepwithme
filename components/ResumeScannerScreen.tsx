import React, { useState, useRef } from 'react';
import { analyzeResumeFile } from '../services/geminiService';
import { updateResume, getProfileDataSync } from '../services/profileService';
import { Subject, Difficulty } from '../types';

interface ResumeScannerScreenProps {
    onBack: () => void;
    onStartInterview: (subject: Subject | string, difficulty: Difficulty) => void;
}

export const ResumeScannerScreen: React.FC<ResumeScannerScreenProps> = ({ onBack, onStartInterview }) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [extractedText, setExtractedText] = useState<string | null>(getProfileDataSync().resumeText || null);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Validate size (e.g., max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError("File is too large. Please upload a file smaller than 5MB.");
            return;
        }

        // Validate type
        const validTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
        if (!validTypes.includes(file.type)) {
            setError("Unsupported file format. Please upload an Image (JPG/PNG) or PDF/PPT.");
            return;
        }

        setIsProcessing(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const result = e.target?.result as string;
                // Extract base64 data without the data URI scheme prefix
                const base64Data = result.includes(',') ? result.split(',')[1] : result;

                // Process through AI
                const analysis = await analyzeResumeFile(base64Data, file.type);
                setExtractedText(analysis);
                // Note: updateResume is now async, await it
                await updateResume(analysis);

            } catch (err: any) {
                console.error("Resume parsing error:", err);
                setError(err.message || "Failed to parse the resume. Ensure it is a clear image or readable PDF.");
            } finally {
                setIsProcessing(false);
            }
        };
        reader.onerror = () => {
            setError("Failed to read the file.");
            setIsProcessing(false);
        };

        reader.readAsDataURL(file);
    };

    const handleStartResumeInterview = () => {
        if (!extractedText) {
            setError("Please upload and analyze a resume first.");
            return;
        }
        // Set 'Resume Interview' as subject, and typically intermediate difficulty mapped to their experience
        onStartInterview('Resume Interview' as Subject, 'Intermediate');
    };

    return (
        <div className="min-h-screen bg-gray-900 px-4 py-8 relative">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center mb-8">
                    <button
                        onClick={onBack}
                        className="text-gray-400 hover:text-white transition-colors mr-4"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-white">AI Resume Scanner</h1>
                        <p className="text-gray-400 mt-2">Upload your resume to generate a personalized interview.</p>
                    </div>
                </div>

                {/* Upload Area */}
                <div
                    className={`border-2 border-dashed rounded-xl p-10 text-center transition-all ${isProcessing ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600 hover:border-blue-400 bg-gray-800'}`}
                    onClick={() => !isProcessing && fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/jpeg, image/png, application/pdf, .ppt, .pptx"
                    />

                    {isProcessing ? (
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                            <p className="text-blue-400 font-semibold text-lg animate-pulse">AI is reading and analyzing your resume...</p>
                        </div>
                    ) : (
                        <div className="cursor-pointer">
                            <div className="text-6xl mb-4">📄</div>
                            <h3 className="text-xl font-semibold text-white mb-2">Click to Upload Resume</h3>
                            <p className="text-gray-400 text-sm">Supports PNG, JPG, PDF, and PPT (Max 5MB)</p>
                        </div>
                    )}
                </div>

                {error && (
                    <div className="mt-6 bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg flex items-start gap-3">
                        <span>⚠️</span>
                        <p>{error}</p>
                    </div>
                )}

                {/* Extracted Data Area */}
                {extractedText && !isProcessing && (
                    <div className="mt-8 bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg animate-fade-in">
                        <h2 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
                            <span>✓</span> Resume Analyzed Successfully
                        </h2>
                        <div className="bg-gray-900 rounded-lg p-4 max-h-60 overflow-y-auto mb-6 text-sm text-gray-300 border border-gray-700">
                            {extractedText.split('\n').map((line, i) => (
                                <p key={i} className="mb-1">{line}</p>
                            ))}
                        </div>

                        <button
                            onClick={handleStartResumeInterview}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform transform hover:-translate-y-1"
                        >
                            Start Personalized Interview Now
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResumeScannerScreen;
