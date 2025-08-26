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

    const formData = new FormData();
    formData.append("audio", file);

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const progress = (e.loaded / e.total) * 100;
          setUploadProgress(progress);
        }
      });

      xhr.addEventListener("load", () => {
        setIsUploading(false);
        if (xhr.status === 200) {
          try {
            const result = JSON.parse(xhr.responseText);
            console.log("Upload successful:", result);
            setAudioFile(result);
            setCurrentStep(2);
          } catch (error) {
            console.error("Failed to parse upload response:", error, xhr.responseText);
          }
        } else {
          console.error("Upload failed with status:", xhr.status, xhr.responseText);
        }
      });

      xhr.addEventListener("error", () => {
        setIsUploading(false);
        console.error("Upload network error");
      });

      xhr.open("POST", "/api/upload");
      xhr.send(formData);
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
            onStartAddingMarkers={() => setIsAddingMarkers(true)}
            onPreviewMix={() => {/* Preview handled internally */}}
            onGenerateAudio={() => setCurrentStep(3)}
            isAddingMarkers={isAddingMarkers}
          />
        )}

        {/* Output Configuration */}
        {markers.length >= 2 && currentStep >= 3 && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Output Configuration</h2>
                <p className="text-sm text-gray-600 mt-1">Choose how segments should be joined together</p>
              </div>

              <div className="space-y-4">
                <div
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    outputMode === "direct" ? "border-primary bg-blue-50" : "border-gray-200 hover:border-primary"
                  }`}
                  onClick={() => setOutputMode("direct")}
                >
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="outputMode"
                      value="direct"
                      checked={outputMode === "direct"}
                      onChange={() => setOutputMode("direct")}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">Cut and Mix (Direct Stitching)</h3>
                        <span className="px-2 py-1 bg-primary text-white text-xs rounded-full">Recommended</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Segments are joined together directly without any transition effects. Clean cuts with immediate transitions.
                      </p>
                    </div>
                  </label>
                </div>

                <div
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    outputMode === "crossfade" ? "border-primary bg-blue-50" : "border-gray-200 hover:border-primary"
                  }`}
                  onClick={() => setOutputMode("crossfade")}
                >
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="outputMode"
                      value="crossfade"
                      checked={outputMode === "crossfade"}
                      onChange={() => setOutputMode("crossfade")}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium text-gray-900">Cut and Mix with Crossfade</h3>
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">Advanced</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        Segments are joined with smooth crossfade transitions. Creates seamless blending between segments.
                      </p>
                      {outputMode === "crossfade" && (
                        <div className="mt-3 flex items-center space-x-4">
                          <label className="text-xs font-medium text-gray-700">Fade Duration:</label>
                          <select
                            value={crossfadeDuration}
                            onChange={(e) => setCrossfadeDuration(Number(e.target.value))}
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            <option value={0.5}>0.5 seconds</option>
                            <option value={1.0}>1.0 seconds</option>
                            <option value={1.5}>1.5 seconds</option>
                            <option value={2.0}>2.0 seconds</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Ready to process <span className="font-medium">{Math.max(0, markers.length - 1)} segments</span> from <span className="font-medium">{markers.length} markers</span> • 
                    Estimated time: <span className="font-medium">~5 seconds</span>
                  </div>
                  <Button onClick={handleProcessAudio} className="bg-green-600 hover:bg-green-700">
                    <Play className="h-4 w-4 mr-2" />
                    Process Audio
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-primary bg-opacity-10 rounded-full flex items-center justify-center">
                  <div className="processing-spinner w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Processing Your Audio</h3>
                  <p className="text-sm text-gray-600 mt-1">Analyzing segments and applying cuts...</p>
                </div>
                <div className="max-w-md mx-auto">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progress</span>
                    <span>{processingProgress}%</span>
                  </div>
                  <Progress value={processingProgress} className="w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Download Section */}
        {processingJob && processingJob.status === "completed" && (
          <Card>
            <CardContent className="p-6">
              <div className="text-center space-y-6">
                <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <Download className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Audio Processing Complete!</h3>
                  <p className="text-sm text-gray-600 mt-1">Your mixed audio file is ready for download</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 max-w-md mx-auto">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary bg-opacity-10 rounded-lg flex items-center justify-center">
                      <Music className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">mixed-audio-output.mp3</p>
                      <p className="text-sm text-gray-500">Mixed audio file ready</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button onClick={() => processingJob?.id && downloadAudio(processingJob.id)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Audio
                  </Button>
                  <Button variant="outline" onClick={handleStartOver}>
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Start New Project
                  </Button>
                </div>

                <div className="text-xs text-gray-500 max-w-md mx-auto flex items-center justify-center space-x-1">
                  <Shield className="h-3 w-3" />
                  <span>Your processed file will be automatically deleted from our servers after 24 hours for privacy and security.</span>
                </div>
              </div>
            </CardContent>
          </Card>
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
