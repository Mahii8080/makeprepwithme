import React, { useState, useRef, useEffect } from 'react';
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
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [backendStatus, setBackendStatus] = useState<'unknown' | 'online' | 'offline'>('unknown');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Ping the backend to see if it's reachable
    useEffect(() => {
        const checkBackend = async () => {
            try {
                const ctrl = new AbortController();
                setTimeout(() => ctrl.abort(), 3000);
                const res = await fetch('http://localhost:4000/api/health', { signal: ctrl.signal });
                setBackendStatus(res.ok ? 'online' : 'offline');
            } catch {
                setBackendStatus('offline');
            }
        };
        checkBackend();
    }, []);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset state
        setError(null);
        setStatusMessage('');

        // Validate size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            setError('File is too large. Please upload a file smaller than 5MB.');
            return;
        }

        // Validate type
        const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
        if (!validTypes.includes(file.type)) {
            if (file.name.endsWith('.doc') || file.name.endsWith('.docx')) {
                setError('Word documents (.doc/.docx) are not directly supported. Please save your resume as a PDF first (File → Save As → PDF) and upload that.');
            } else if (file.name.endsWith('.ppt') || file.name.endsWith('.pptx')) {
                setError('PowerPoint files are not supported. Please upload an Image (JPG/PNG) or PDF instead.');
            } else {
                setError('Unsupported file format. Please upload an Image (JPG/PNG) or PDF.');
            }
            return;
        }

        setIsProcessing(true);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const result = e.target?.result as string;
                // Extract base64 data without the data URI scheme prefix
                const base64Data = result.includes(',') ? result.split(',')[1] : result;

                setStatusMessage(backendStatus === 'online'
                    ? '🔄 Sending to backend AI server...'
                    : '⚡ Backend offline — trying direct Gemini AI...');

                // Process through AI (multi-fallback chain)
                const analysis = await analyzeResumeFile(base64Data, file.type);
                setExtractedText(analysis);
                setStatusMessage('✅ Analysis complete!');
                await updateResume(analysis);

            } catch (err: any) {
                console.error('Resume parsing error:', err);
                const rawMsg: string = err.message || 'Failed to parse the resume.';
                // Show a clean, user-friendly version of the error
                const friendlyMsg = rawMsg.includes('All AI services are unavailable')
                    ? `All AI services are currently unavailable.\n\n${rawMsg}`
                    : rawMsg.includes('quota') || rawMsg.includes('429')
                    ? 'The AI API quota has been exceeded. Please try again in a few minutes or use a different API key.'
                    : rawMsg.includes('network') || rawMsg.includes('fetch') || rawMsg.includes('connect')
                    ? 'Could not connect to any AI service. Please check your internet connection and try again.'
                    : rawMsg;
                setError(friendlyMsg);
            } finally {
                setIsProcessing(false);
            }
        };
        reader.onerror = () => {
            setError('Failed to read the file. Please try again.');
            setIsProcessing(false);
        };

        reader.readAsDataURL(file);
    };

    const handleStartResumeInterview = () => {
        if (!extractedText) {
            setError('Please upload and analyze a resume first.');
            return;
        }
        onStartInterview('Resume Interview' as Subject, 'Intermediate');
    };

    const BackendBadge = () => {
        if (backendStatus === 'unknown') return null;
        return (
            <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                backendStatus === 'online'
                    ? 'bg-green-900/40 text-green-400 border border-green-700/40'
                    : 'bg-yellow-900/30 text-yellow-400 border border-yellow-700/40'
            }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${backendStatus === 'online' ? 'bg-green-400' : 'bg-yellow-400'}`} />
                {backendStatus === 'online' ? 'Backend Online' : 'Backend Offline — Using Direct AI'}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-900 px-4 py-8 relative">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center mb-3">
                    <button
                        onClick={onBack}
                        className="text-gray-400 hover:text-white transition-colors mr-4"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </button>
                    <div className="flex-1">
                        <h1 className="text-3xl font-bold text-white">AI Resume Scanner</h1>
                        <p className="text-gray-400 mt-1">Upload your resume to generate a personalized interview.</p>
                    </div>
                </div>

                {/* Backend status badge */}
                <div className="mb-6 pl-10">
                    <BackendBadge />
                </div>

                {/* Upload Area */}
                <div
                    className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
                        isProcessing
                            ? 'border-blue-500 bg-blue-900/20 cursor-not-allowed'
                            : 'border-gray-600 hover:border-blue-400 bg-gray-800 hover:bg-gray-750'
                    }`}
                    onClick={() => !isProcessing && fileInputRef.current?.click()}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/jpeg,image/png,application/pdf"
                    />

                    {isProcessing ? (
                        <div className="flex flex-col items-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                            <p className="text-blue-400 font-semibold text-lg animate-pulse">AI is reading and analyzing your resume...</p>
                            {statusMessage && (
                                <p className="text-gray-400 text-sm mt-2">{statusMessage}</p>
                            )}
                        </div>
                    ) : (
                        <div>
                            <div className="text-6xl mb-4">📄</div>
                            <h3 className="text-xl font-semibold text-white mb-2">Click to Upload Resume</h3>
                            <p className="text-gray-400 text-sm">Supports PNG, JPG, and PDF (Max 5MB)</p>
                            <div className="mt-3 flex justify-center gap-2">
                                {['PDF', 'JPG', 'PNG'].map(fmt => (
                                    <span key={fmt} className="bg-gray-700 text-gray-300 text-xs px-2.5 py-1 rounded-md font-mono">{fmt}</span>
                                ))}
                            </div>
                            <p className="text-gray-500 text-xs mt-3">
                                💡 For Word docs (.docx), save as PDF first via File → Save As → PDF
                            </p>
                        </div>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="mt-6 bg-red-900/30 border border-red-500/50 text-red-200 px-4 py-4 rounded-lg">
                        <div className="flex items-start gap-3">
                            <span className="text-xl mt-0.5 shrink-0">⚠️</span>
                            <div>
                                {error.split('\n').map((line, i) => (
                                    <p key={i} className={`${i === 0 ? 'font-semibold' : 'text-red-300 text-sm mt-1'}`}>{line}</p>
                                ))}
                            </div>
                        </div>
                        {backendStatus === 'offline' && (
                            <div className="mt-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-3 py-2 text-yellow-300 text-sm">
                                <strong>💡 Tip:</strong> Start the backend server by running{' '}
                                <code className="bg-black/30 px-1.5 py-0.5 rounded font-mono text-xs">npm run dev:full</code>{' '}
                                in the project root for best results.
                            </div>
                        )}
                    </div>
                )}

                {/* Extracted Data Area */}
                {extractedText && !isProcessing && (
                    <div className="mt-8 bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-lg">
                        <h2 className="text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
                            <span>✓</span> Resume Analyzed Successfully
                        </h2>
                        <div className="bg-gray-900 rounded-lg p-4 max-h-72 overflow-y-auto mb-6 text-sm text-gray-300 border border-gray-700 leading-relaxed">
                            {extractedText.split('\n').map((line, i) => {
                                // Style section headers (lines starting with numbers or all-caps keywords)
                                const isHeader = /^(\d+\.|#{1,3}\s|[A-Z][A-Z\s]{3,}:)/.test(line.trim());
                                return (
                                    <p key={i} className={`mb-1 ${isHeader ? 'text-blue-300 font-semibold mt-2' : ''}`}>
                                        {line || '\u00A0'}
                                    </p>
                                );
                            })}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleStartResumeInterview}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 hover:shadow-blue-500/25"
                            >
                                🎯 Start Personalized Interview
                            </button>
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-5 py-4 bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold rounded-xl transition-colors"
                                title="Upload a different resume"
                            >
                                🔄 Re-upload
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResumeScannerScreen;

