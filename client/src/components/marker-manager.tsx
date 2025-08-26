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
  isAddingMarkers,
}: MarkerManagerProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
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

  const handlePreviewMix = async () => {
    if (sortedMarkers.length < 2) {
      toast({
        title: "Need more markers",
        description: "At least 2 markers are required to create a preview",
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
                ? "Add markers to create segments for your mix"
                : `${markers.length} markers • ${Math.max(0, markers.length - 1)} segments`
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
            {/* Markers List */}
            <div className="space-y-3">
              {sortedMarkers.map((marker, index) => {
                const originalIndex = markers.findIndex(m => m.timestamp === marker.timestamp && m.order === marker.order);
                const isEditing = editingIndex === originalIndex;
                
                return (
                  <div key={originalIndex} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">Marker {index + 1}</span>
                          {isEditing ? (
                            <div className="flex items-center space-x-2 mt-1">
                              <div className="flex space-x-1">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  min="0"
                                  defaultValue={formatTime(marker.timestamp).mins}
                                  className="w-16 h-8 text-xs text-center"
                                  data-testid={`input-marker-minutes-${index}`}
                                />
                                <span className="text-xs text-gray-500 self-center">:</span>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  min="0"
                                  max="59"
                                  defaultValue={formatTime(marker.timestamp).secs}
                                  className="w-16 h-8 text-xs text-center"
                                  data-testid={`input-marker-seconds-${index}`}
                                />
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const minutesInput = document.querySelector(`[data-testid="input-marker-minutes-${index}"]`) as HTMLInputElement;
                                  const secondsInput = document.querySelector(`[data-testid="input-marker-seconds-${index}"]`) as HTMLInputElement;
                                  const mins = parseInt(minutesInput.value) || 0;
                                  const secs = parseInt(secondsInput.value) || 0;
                                  updateMarkerTime(originalIndex, parseTime(mins, secs));
                                }}
                                className="h-8 text-green-600 hover:text-green-700"
                              >
                                <Save className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingIndex(null)}
                                className="h-8 text-gray-400 hover:text-gray-600"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="text-sm text-gray-600 mt-1">
                              {formatTimeDisplay(marker.timestamp)}
                            </div>
                          )}
                        </div>
                      </div>
                      {!isEditing && (
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingIndex(originalIndex)}
                            className="text-gray-400 hover:text-blue-500"
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeMarker(originalIndex)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
                
                {sortedMarkers.length >= 2 && (
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

              {sortedMarkers.length >= 2 && (
                <Button 
                  onClick={onGenerateAudio}
                  className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
                  data-testid="button-generate-audio"
                >
                  <span>Generate Final Audio</span>
                  <Play className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}