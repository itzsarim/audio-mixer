import { useState, useRef } from "react";
import { Trash2, Clock, Play, Edit3, Save, X, Volume2, Pause, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface MarkerManagerProps {
  markers: Array<{ timestamp: number; order: number }>;
  onMarkersChange: (markers: Array<{ timestamp: number; order: number }>) => void;
  audioDuration: number;
  audioFileId: string;
  originalFile?: File | null;
  onStartAddingMarkers: () => void;
  onPreviewMix: () => void;
  onGenerateAudio: () => void;
  onDownloadAudio: (jobId: string) => void;
  isAddingMarkers: boolean;
}

export default function MarkerManager({
  markers,
  onMarkersChange,
  audioDuration,
  audioFileId,
  originalFile,
  onStartAddingMarkers,
  onPreviewMix,
  onGenerateAudio,
  onDownloadAudio,
  isAddingMarkers,
}: MarkerManagerProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedJobId, setGeneratedJobId] = useState<string | null>(null);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const [outputMode, setOutputMode] = useState<"direct" | "crossfade">("direct");
  const [crossfadeDuration, setCrossfadeDuration] = useState(1.0);
  const { toast } = useToast();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    return { mins, secs, ms };
  };

  const parseTime = (mins: number, secs: number, ms: number = 0): number => {
    return (mins || 0) * 60 + (secs || 0) + (ms || 0) / 1000;
  };

  const formatTimeDisplay = (seconds: number) => {
    const { mins, secs, ms } = formatTime(seconds);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
  };

  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);
  const isEvenMarkers = sortedMarkers.length % 2 === 0;
  const segmentCount = Math.floor(sortedMarkers.length / 2);

  const removeMarker = (index: number) => {
    const newMarkers = markers.filter((_, i) => i !== index);
    // Reorder the remaining markers
    const reorderedMarkers = newMarkers.map((marker, i) => ({
      ...marker,
      order: i,
    }));
    onMarkersChange(reorderedMarkers);
  };

  const updateMarkerTime = (index: number, newTimestamp: number) => {
    if (newTimestamp < 0 || newTimestamp > audioDuration) {
      toast({
        title: "Invalid time",
        description: "Timestamp must be within audio duration",
        variant: "destructive",
      });
      return;
    }

    const newMarkers = markers.map((marker, i) =>
      i === index ? { ...marker, timestamp: newTimestamp } : marker
    );
    onMarkersChange(newMarkers);
    setEditingIndex(null);
  };

  const handlePreviewPlayPause = () => {
    if (previewAudioRef.current) {
      if (isPreviewPlaying) {
        previewAudioRef.current.pause();
      } else {
        previewAudioRef.current.play();
      }
      setIsPreviewPlaying(!isPreviewPlaying);
    }
  };

  const handleStopPreview = () => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setIsPreviewPlaying(false);
    }
  };

  const handleRegeneratePreview = () => {
    // Reset preview state
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setIsPreviewPlaying(false);
    }
    setPreviewAudioUrl(null);
    
    // Generate new preview
    handlePreviewMix();
  };

  const handleGenerateAudio = async () => {
    if (!isEvenMarkers || segmentCount < 1) {
      toast({
        title: "Invalid markers",
        description: !isEvenMarkers 
          ? "You need an even number of markers. Add an end marker for the last segment."
          : "At least one complete segment (2 markers) is required.",
        variant: "destructive",
      });
      return;
    }

    // Stop and reset preview audio when generating
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
      setIsPreviewPlaying(false);
    }

    setIsGenerating(true);
    try {
      let response: Response;
      if (import.meta.env.DEV) {
        // Use local job-based processing flow in dev
        response = await fetch("/api/process", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioFileId,
            markers: sortedMarkers,
            outputMode,
            crossfadeDuration,
          }),
        });
        if (!response.ok) throw new Error("Failed to start processing");
        const { jobId } = await response.json();
        setGeneratedJobId(jobId);
        const poll = async () => {
          const s = await fetch(`/api/jobs/${jobId}`);
          const job = await s.json();
          if (job.status === "completed") {
            toast({ title: "Audio ready!", description: "Your mixed audio file is ready to download" });
            setIsGenerating(false);
          } else if (job.status === "failed") {
            throw new Error("Processing failed");
          } else {
            setTimeout(poll, 1000);
          }
        };
        poll();
        onGenerateAudio();
        return;
      } else {
        if (!originalFile) throw new Error("No original file found");
        const form = new FormData();
        form.append("audio", originalFile);
        form.append("markers", JSON.stringify(sortedMarkers));
        form.append("outputMode", outputMode);
        form.append("crossfadeDuration", String(crossfadeDuration));
        response = await fetch("/api/process-upload", { method: "POST", body: form });
      }

      if (!response.ok) throw new Error("Failed to generate audio");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mixed-audio-${crypto.randomUUID()}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setIsGenerating(false);
      toast({ title: "Download started", description: "Your audio is downloading." });
    } catch (error) {
      console.error("Generate error:", error);
      toast({
        title: "Generation failed",
        description: "Could not generate audio. Please try again.",
        variant: "destructive",
      });
      setIsGenerating(false);
    }
  };

  const handlePreviewMix = async () => {
    if (!isEvenMarkers || segmentCount < 1) {
      toast({
        title: "Invalid markers",
        description: !isEvenMarkers 
          ? "You need an even number of markers. Add an end marker for the last segment."
          : "At least one complete segment (2 markers) is required.",
        variant: "destructive",
      });
      return;
    }

    setIsPreviewLoading(true);
    try {
      if (!originalFile) throw new Error("No original file found");
      const form = new FormData();
      form.append("audio", originalFile);
      form.append("markers", JSON.stringify(sortedMarkers));
      form.append("outputMode", outputMode);
      form.append("crossfadeDuration", String(crossfadeDuration));
      const response = await fetch("/api/process-upload", { method: "POST", body: form });
      if (!response.ok) throw new Error("Failed to generate preview");
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      setPreviewAudioUrl(audioUrl);

      toast({
        title: "Preview ready",
        description: "Click play to listen to your mixed audio preview",
      });

      onPreviewMix();
    } catch (error) {
      console.error("Preview error:", error);
      toast({
        title: "Preview failed",
        description: "Could not generate preview. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  if (isAddingMarkers) {
    return (
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto mb-4 text-orange-500" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Adding Markers</h2>
            <p className="text-gray-600 mb-4">
              Play the audio and click "Add Marker" to mark important moments
            </p>
            <div className="text-sm text-gray-500">
              Current markers: {markers.length}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Audio Markers</h2>
            <p className="text-sm text-gray-600 mt-1">
              {markers.length === 0 
                ? "Add markers in pairs - each pair creates one segment"
                : isEvenMarkers 
                  ? `${markers.length} markers • ${segmentCount} segments ready`
                  : `${markers.length} markers • Missing end marker for segment ${segmentCount + 1}`
              }
            </p>
          </div>
          {markers.length === 0 && (
            <Button 
              onClick={onStartAddingMarkers} 
              className="flex items-center space-x-2"
              data-testid="button-start-adding-markers"
            >
              <Clock className="h-4 w-4" />
              <span>Start Adding Markers</span>
            </Button>
          )}
        </div>

        {markers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>No markers added yet. Click "Start Adding Markers" to begin.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Error for odd markers */}
            {!isEvenMarkers && markers.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                    <span className="text-xs text-white font-bold">!</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-yellow-800">
                      Missing end marker for segment {segmentCount + 1}
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Add one more marker to complete the segment, or remove the last marker.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Segments List (grouped by pairs) */}
            <div className="space-y-4">
              {Array.from({ length: segmentCount }, (_, segmentIndex) => {
                const startMarkerIndex = segmentIndex * 2;
                const endMarkerIndex = segmentIndex * 2 + 1;
                const startMarker = sortedMarkers[startMarkerIndex];
                const endMarker = sortedMarkers[endMarkerIndex];
                const duration = endMarker.timestamp - startMarker.timestamp;
                
                return (
                  <div key={segmentIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {segmentIndex + 1}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">Segment {segmentIndex + 1}</span>
                          <div className="text-sm text-gray-600 mt-1">
                            Duration: {formatTimeDisplay(duration)}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Start Marker */}
                      <div className="border border-green-200 rounded-lg p-3 bg-green-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium text-green-800">Start</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const originalIndex = markers.findIndex(m => m.timestamp === startMarker.timestamp);
                                setEditingIndex(originalIndex);
                              }}
                              className="h-6 w-6 p-0 text-green-600 hover:text-green-700"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const originalIndex = markers.findIndex(m => m.timestamp === startMarker.timestamp);
                                removeMarker(originalIndex);
                              }}
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm font-mono text-green-700 mt-1">
                          {formatTimeDisplay(startMarker.timestamp)}
                        </div>
                        {editingIndex === markers.findIndex(m => m.timestamp === startMarker.timestamp) && (
                          <div className="flex items-center justify-center space-x-2 mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex flex-col items-center">
                              <Label className="text-xs text-gray-500 mb-1">Min</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                value={formatTime(startMarker.timestamp).mins}
                                onChange={(e) => {
                                  const mins = parseInt(e.target.value) || 0;
                                  const { secs, ms } = formatTime(startMarker.timestamp);
                                  const originalIndex = markers.findIndex(m => m.timestamp === startMarker.timestamp);
                                  updateMarkerTime(originalIndex, parseTime(mins, secs, ms));
                                }}
                                className="w-16 h-8 text-sm text-center"
                                data-testid={`input-start-minutes-${segmentIndex}`}
                              />
                            </div>
                            <span className="text-lg text-gray-500 mt-4">:</span>
                            <div className="flex flex-col items-center">
                              <Label className="text-xs text-gray-500 mb-1">Sec</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                max="59"
                                value={formatTime(startMarker.timestamp).secs}
                                onChange={(e) => {
                                  const secs = parseInt(e.target.value) || 0;
                                  const { mins, ms } = formatTime(startMarker.timestamp);
                                  const originalIndex = markers.findIndex(m => m.timestamp === startMarker.timestamp);
                                  updateMarkerTime(originalIndex, parseTime(mins, secs, ms));
                                }}
                                className="w-16 h-8 text-sm text-center"
                                data-testid={`input-start-seconds-${segmentIndex}`}
                              />
                            </div>
                            <span className="text-lg text-gray-500 mt-4">.</span>
                            <div className="flex flex-col items-center">
                              <Label className="text-xs text-gray-500 mb-1">Ms</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                max="999"
                                value={formatTime(startMarker.timestamp).ms}
                                onChange={(e) => {
                                  const ms = parseInt(e.target.value) || 0;
                                  const { mins, secs } = formatTime(startMarker.timestamp);
                                  const originalIndex = markers.findIndex(m => m.timestamp === startMarker.timestamp);
                                  updateMarkerTime(originalIndex, parseTime(mins, secs, ms));
                                }}
                                className="w-20 h-8 text-sm text-center"
                                data-testid={`input-start-milliseconds-${segmentIndex}`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* End Marker */}
                      <div className="border border-red-200 rounded-lg p-3 bg-red-50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                            <span className="text-sm font-medium text-red-800">End</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const originalIndex = markers.findIndex(m => m.timestamp === endMarker.timestamp);
                                setEditingIndex(originalIndex);
                              }}
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const originalIndex = markers.findIndex(m => m.timestamp === endMarker.timestamp);
                                removeMarker(originalIndex);
                              }}
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-sm font-mono text-red-700 mt-1">
                          {formatTimeDisplay(endMarker.timestamp)}
                        </div>
                        {editingIndex === markers.findIndex(m => m.timestamp === endMarker.timestamp) && (
                          <div className="flex items-center justify-center space-x-2 mt-3 p-3 bg-gray-50 rounded-lg">
                            <div className="flex flex-col items-center">
                              <Label className="text-xs text-gray-500 mb-1">Min</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                value={formatTime(endMarker.timestamp).mins}
                                onChange={(e) => {
                                  const mins = parseInt(e.target.value) || 0;
                                  const { secs, ms } = formatTime(endMarker.timestamp);
                                  const originalIndex = markers.findIndex(m => m.timestamp === endMarker.timestamp);
                                  updateMarkerTime(originalIndex, parseTime(mins, secs, ms));
                                }}
                                className="w-16 h-8 text-sm text-center"
                                data-testid={`input-end-minutes-${segmentIndex}`}
                              />
                            </div>
                            <span className="text-lg text-gray-500 mt-4">:</span>
                            <div className="flex flex-col items-center">
                              <Label className="text-xs text-gray-500 mb-1">Sec</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                max="59"
                                value={formatTime(endMarker.timestamp).secs}
                                onChange={(e) => {
                                  const secs = parseInt(e.target.value) || 0;
                                  const { mins, ms } = formatTime(endMarker.timestamp);
                                  const originalIndex = markers.findIndex(m => m.timestamp === endMarker.timestamp);
                                  updateMarkerTime(originalIndex, parseTime(mins, secs, ms));
                                }}
                                className="w-16 h-8 text-sm text-center"
                                data-testid={`input-end-seconds-${segmentIndex}`}
                              />
                            </div>
                            <span className="text-lg text-gray-500 mt-4">.</span>
                            <div className="flex flex-col items-center">
                              <Label className="text-xs text-gray-500 mb-1">Ms</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                max="999"
                                value={formatTime(endMarker.timestamp).ms}
                                onChange={(e) => {
                                  const ms = parseInt(e.target.value) || 0;
                                  const { mins, secs } = formatTime(endMarker.timestamp);
                                  const originalIndex = markers.findIndex(m => m.timestamp === endMarker.timestamp);
                                  updateMarkerTime(originalIndex, parseTime(mins, secs, ms));
                                }}
                                className="w-20 h-8 text-sm text-center"
                                data-testid={`input-end-milliseconds-${segmentIndex}`}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Show unpaired last marker if odd */}
              {!isEvenMarkers && markers.length > 0 && (
                <div className="border border-yellow-200 rounded-lg p-4 bg-yellow-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-yellow-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      ?
                    </div>
                    <div>
                      <span className="font-medium text-yellow-800">Unpaired Start Marker</span>
                      <div className="text-sm text-yellow-700 mt-1">
                        {formatTimeDisplay(sortedMarkers[sortedMarkers.length - 1].timestamp)} - Needs end marker
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Output Mode Selection */}
            {isEvenMarkers && segmentCount >= 1 && (
              <div className="pt-4 border-t border-gray-200">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Mix Output Mode</h3>
                  <p className="text-sm text-gray-600">Choose how segments should be joined together</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {/* Direct mixing */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      outputMode === "direct" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
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
                          <h4 className="font-medium text-gray-900">Direct Mix</h4>
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Default</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Segments are joined together directly without transitions. Clean cuts with immediate switches.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Crossfade mixing */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      outputMode === "crossfade" ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
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
                          <h4 className="font-medium text-gray-900">Crossfade Mix</h4>
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-medium">Optional</span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Segments blend with smooth crossfade transitions. Creates seamless flow between segments.
                        </p>
                        {outputMode === "crossfade" && (
                          <div className="mt-3 flex items-center space-x-3">
                            <label className="text-xs font-medium text-gray-700">Fade Duration:</label>
                            <select
                              value={crossfadeDuration}
                              onChange={(e) => setCrossfadeDuration(Number(e.target.value))}
                              className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                              onClick={(e) => e.stopPropagation()}
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
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col space-y-4 pt-4 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3">
                <Button 
                  onClick={onStartAddingMarkers} 
                  variant="outline"
                  className="flex items-center justify-center space-x-2"
                  data-testid="button-add-more-markers"
                >
                  <Clock className="h-4 w-4" />
                  <span>Add More Markers</span>
                </Button>
                
                {isEvenMarkers && segmentCount >= 1 && (
                  <>
                    {!previewAudioUrl ? (
                      <Button 
                        onClick={handlePreviewMix}
                        variant="outline"
                        disabled={isPreviewLoading}
                        className="flex items-center justify-center space-x-2"
                        data-testid="button-preview-mix"
                      >
                        <Volume2 className="h-4 w-4" />
                        <span>{isPreviewLoading ? "Generating..." : "Preview Mix"}</span>
                      </Button>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Button 
                          onClick={handlePreviewPlayPause}
                          variant="outline"
                          className="flex items-center justify-center space-x-2"
                          data-testid="button-preview-play-pause"
                        >
                          {isPreviewPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          <span>{isPreviewPlaying ? "Pause" : "Play"} Preview</span>
                        </Button>
                        <Button 
                          onClick={handleStopPreview}
                          variant="outline"
                          size="sm"
                          className="flex items-center justify-center space-x-1"
                          data-testid="button-stop-preview"
                        >
                          <Square className="h-3 w-3" />
                          <span>Stop</span>
                        </Button>
                        <Button 
                          onClick={handleRegeneratePreview}
                          variant="outline"
                          size="sm"
                          disabled={isPreviewLoading}
                          className="flex items-center justify-center space-x-1"
                          data-testid="button-regenerate-preview"
                        >
                          <Volume2 className="h-3 w-3" />
                          <span>{isPreviewLoading ? "Generating..." : "Regenerate"}</span>
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {isEvenMarkers && segmentCount >= 1 && (
                <>
                  {!generatedJobId ? (
                    <Button 
                      onClick={handleGenerateAudio}
                      disabled={isGenerating}
                      className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                      data-testid="button-generate-audio"
                    >
                      <span>{isGenerating ? "Generating..." : "Generate & Download"}</span>
                      <Play className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={() => onDownloadAudio(generatedJobId)}
                      className="bg-green-600 hover:bg-green-700 w-full sm:w-auto"
                      data-testid="button-download-audio"
                    >
                      <span>Download Audio</span>
                      <Play className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Hidden audio element for preview playback */}
      {previewAudioUrl && (
        <audio
          ref={previewAudioRef}
          src={previewAudioUrl}
          onPlay={() => setIsPreviewPlaying(true)}
          onPause={() => setIsPreviewPlaying(false)}
          onEnded={() => setIsPreviewPlaying(false)}
          preload="metadata"
        />
      )}
    </Card>
  );
}