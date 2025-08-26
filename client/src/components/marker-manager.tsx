import { useState } from "react";
import { Trash2, Clock, Play, Edit3, Save, X, Volume2 } from "lucide-react";
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
  const { toast } = useToast();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return { mins, secs };
  };

  const parseTime = (mins: number, secs: number): number => {
    return (mins || 0) * 60 + (secs || 0);
  };

  const formatTimeDisplay = (seconds: number) => {
    const { mins, secs } = formatTime(seconds);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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

    setIsGenerating(true);
    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioFileId,
          markers: sortedMarkers,
          outputMode: "crossfade",
          crossfadeDuration: 1.0,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate audio");
      }

      const result = await response.json();
      setGeneratedJobId(result.jobId);
      
      // Poll for completion
      const pollStatus = async () => {
        const statusResponse = await fetch(`/api/jobs/${result.jobId}`);
        const job = await statusResponse.json();
        
        if (job.status === "completed") {
          toast({
            title: "Audio ready!",
            description: "Your mixed audio file is ready to download",
          });
          setIsGenerating(false);
        } else if (job.status === "failed") {
          throw new Error("Processing failed");
        } else {
          setTimeout(pollStatus, 1000);
        }
      };
      
      pollStatus();
      onGenerateAudio();
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
      const response = await fetch("/api/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioFileId,
          markers: sortedMarkers,
          crossfadeDuration: 1.0,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate preview");
      }

      // Create audio element and play the preview
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audio.play();

      toast({
        title: "Preview ready",
        description: "Playing crossfaded preview",
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
                          <div className="flex items-center space-x-2 mt-2">
                            <div className="flex space-x-1">
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                defaultValue={formatTime(startMarker.timestamp).mins}
                                className="w-12 h-6 text-xs text-center"
                                data-testid={`input-start-minutes-${segmentIndex}`}
                              />
                              <span className="text-xs text-gray-500 self-center">:</span>
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                max="59"
                                defaultValue={formatTime(startMarker.timestamp).secs}
                                className="w-12 h-6 text-xs text-center"
                                data-testid={`input-start-seconds-${segmentIndex}`}
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const minutesInput = document.querySelector(`[data-testid="input-start-minutes-${segmentIndex}"]`) as HTMLInputElement;
                                const secondsInput = document.querySelector(`[data-testid="input-start-seconds-${segmentIndex}"]`) as HTMLInputElement;
                                const mins = parseInt(minutesInput.value) || 0;
                                const secs = parseInt(secondsInput.value) || 0;
                                const originalIndex = markers.findIndex(m => m.timestamp === startMarker.timestamp);
                                updateMarkerTime(originalIndex, parseTime(mins, secs));
                              }}
                              className="h-6 text-green-600 hover:text-green-700"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
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
                          <div className="flex items-center space-x-2 mt-2">
                            <div className="flex space-x-1">
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                defaultValue={formatTime(endMarker.timestamp).mins}
                                className="w-12 h-6 text-xs text-center"
                                data-testid={`input-end-minutes-${segmentIndex}`}
                              />
                              <span className="text-xs text-gray-500 self-center">:</span>
                              <Input
                                type="number"
                                placeholder="0"
                                min="0"
                                max="59"
                                defaultValue={formatTime(endMarker.timestamp).secs}
                                className="w-12 h-6 text-xs text-center"
                                data-testid={`input-end-seconds-${segmentIndex}`}
                              />
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                const minutesInput = document.querySelector(`[data-testid="input-end-minutes-${segmentIndex}"]`) as HTMLInputElement;
                                const secondsInput = document.querySelector(`[data-testid="input-end-seconds-${segmentIndex}"]`) as HTMLInputElement;
                                const mins = parseInt(minutesInput.value) || 0;
                                const secs = parseInt(secondsInput.value) || 0;
                                const originalIndex = markers.findIndex(m => m.timestamp === endMarker.timestamp);
                                updateMarkerTime(originalIndex, parseTime(mins, secs));
                              }}
                              className="h-6 text-red-600 hover:text-red-700"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
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
    </Card>
  );
}