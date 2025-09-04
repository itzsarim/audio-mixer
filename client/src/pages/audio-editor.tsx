import { useState } from "react";
import { Music, HelpCircle, Upload, Clock, Play, Pause, Download, RotateCcw, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import ProgressSteps from "@/components/progress-steps";
import WaveformVisualizer from "@/components/waveform-visualizer";
import MarkerManager from "@/components/marker-manager";
import { useAudioProcessor } from "@/hooks/use-audio-processor";
import type { AudioFile } from "@shared/schema";

export default function AudioEditor() {
  const [audioFile, setAudioFile] = useState<AudioFile | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [markers, setMarkers] = useState<Array<{ timestamp: number; order: number }>>([]);
  const [isAddingMarkers, setIsAddingMarkers] = useState(false);
  const [outputMode, setOutputMode] = useState<"direct" | "crossfade">("direct");
  const [crossfadeDuration, setCrossfadeDuration] = useState(1.0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const {
    processAudio,
    downloadAudio,
    processingJob,
    isProcessing,
    processingProgress,
  } = useAudioProcessor();

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      if (import.meta.env.DEV) {
        // Development: upload to local Express server and use server audio URL
        const formData = new FormData();
        formData.append("audio", file);

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) setUploadProgress((e.loaded / e.total) * 100);
          });
          xhr.addEventListener("load", () => {
            if (xhr.status === 200) {
              try {
                const result = JSON.parse(xhr.responseText);
                setAudioFile(result);
                setAudioSrc(`/api/audio/${result.id}/file`);
                setCurrentStep(2);
                resolve();
              } catch (err) {
                reject(err);
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          });
          xhr.addEventListener("error", () => reject(new Error("Upload network error")));
          xhr.open("POST", "/api/upload");
          xhr.send(formData);
        });
      } else {
        // Production (Vercel): keep file client-side and use blob URL
        const url = URL.createObjectURL(file);
        setAudioSrc(url);
        setOriginalFile(file);
        const duration = await new Promise<number>((resolve, reject) => {
          const audio = new Audio();
          audio.preload = "metadata";
          audio.src = url;
          audio.onloadedmetadata = () => resolve(audio.duration || 0);
          audio.onerror = () => reject(new Error("Failed to load audio metadata"));
        });
        const faux: AudioFile = {
          id: crypto.randomUUID(),
          filename: file.name,
          originalName: file.name,
          duration,
          format: file.type.includes("wav") ? ".wav" : ".mp3",
          uploadedAt: new Date(),
        } as any;
        setAudioFile(faux);
        setCurrentStep(2);
      }
      setIsUploading(false);
      setUploadProgress(100);
    } catch (error) {
      setIsUploading(false);
      console.error("Upload error:", error);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    const audioFile = files.find(file => 
      file.type === "audio/mpeg" || file.type === "audio/wav" || file.type === "audio/mp3"
    );
    if (audioFile) {
      handleFileUpload(audioFile);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleProcessAudio = async () => {
    if (!audioFile || markers.length < 2) return;

    const jobId = await processAudio({
      audioFileId: audioFile.id,
      markers: markers.sort((a, b) => a.timestamp - b.timestamp),
      outputMode,
      crossfadeDuration: outputMode === "crossfade" ? crossfadeDuration : undefined,
    });

    if (jobId) {
      setCurrentStep(4);
    }
  };

  const handleStartOver = () => {
    setAudioFile(null);
    setCurrentStep(1);
    setMarkers([]);
    setIsAddingMarkers(false);
    setOutputMode("crossfade");
    setCrossfadeDuration(1.0);
    setUploadProgress(0);
    setIsUploading(false);
    if (audioSrc) URL.revokeObjectURL(audioSrc);
    setAudioSrc(null);
    setOriginalFile(null);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-primary text-white p-2 rounded-lg">
                <Music className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">Audio Cut & Mix</h1>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Professional audio editing tool</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                <HelpCircle className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Progress Steps */}
        <ProgressSteps currentStep={currentStep} />

        {/* Audio Upload Section */}
        {currentStep >= 1 && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Upload Audio File</h2>
                  <p className="text-sm text-gray-600 mt-1">Supported formats: MP3, WAV (max 60 minutes)</p>
                </div>
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-500">
                  <Shield className="h-4 w-4" />
                  <span className="hidden sm:inline">Files are processed securely and not stored</span>
                  <span className="sm:hidden">Secure processing</span>
                </div>
              </div>

              {!audioFile && !isUploading && (
                <div
                  className="upload-area p-8 text-center"
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <div className="space-y-4">
                    <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                      <Upload className="h-8 w-8 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-lg font-medium text-gray-700">Drop your audio file here</p>
                      <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                    </div>
                    <div>
                      <input
                        type="file"
                        accept="audio/mp3,audio/wav,audio/mpeg"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="audio-upload"
                      />
                      <Button asChild>
                        <label htmlFor="audio-upload" className="cursor-pointer">
                          Choose File
                        </label>
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {isUploading && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>Uploading...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                </div>
              )}

              {audioFile && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Music className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">{audioFile.originalName}</span>
                    <span className="text-sm text-green-700">
                      • {formatDuration(audioFile.duration)} duration
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Waveform Visualization */}
        {audioFile && currentStep >= 2 && (
          <WaveformVisualizer
            audioFile={audioFile}
            audioSrc={audioSrc || ""}
            markers={markers}
            onMarkersChange={setMarkers}
            isAddingMarkers={isAddingMarkers}
            onDoneAddingMarkers={() => {
              setIsAddingMarkers(false);
              if (markers.length >= 2) {
                setCurrentStep(3);
              }
            }}
          />
        )}

        {/* Marker Management */}
        {audioFile && currentStep >= 2 && (
          <MarkerManager
            markers={markers}
            onMarkersChange={setMarkers}
            audioDuration={audioFile.duration}
            audioFileId={audioFile.id}
            originalFile={originalFile}
            onStartAddingMarkers={() => setIsAddingMarkers(true)}
            onPreviewMix={() => {/* Preview handled internally */}}
            onGenerateAudio={() => {}}
            onDownloadAudio={downloadAudio}
            isAddingMarkers={isAddingMarkers}
          />
        )}



      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <a href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-gray-900 transition-colors">Help & Support</a>
            </div>
            <div className="text-sm text-gray-500">
              © 2024 Audio Cut & Mix Tool. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
