import { useEffect, useRef, useState } from "react";
import { Play, Pause, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AudioFile } from "@shared/schema";

// Note: In a real implementation, you would install and import WaveSurfer.js
// For this demo, we'll create a simplified waveform visualization

interface WaveformVisualizerProps {
  audioFile: AudioFile;
  markers: Array<{ timestamp: number; order: number }>;
  onMarkersChange: (markers: Array<{ timestamp: number; order: number }>) => void;
  isAddingMarkers: boolean;
  onDoneAddingMarkers: () => void;
}

export default function WaveformVisualizer({
  audioFile,
  markers,
  onMarkersChange,
  isAddingMarkers,
  onDoneAddingMarkers,
}: WaveformVisualizerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent) => {
    if (!waveformRef.current || !audioRef.current) return;

    const rect = waveformRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * audioFile.duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleAddMarker = () => {
    if (!audioRef.current) return;
    
    const timestamp = audioRef.current.currentTime;
    const newMarkers = [...markers, { timestamp, order: markers.length }];
    onMarkersChange(newMarkers);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("ended", () => setIsPlaying(false));
      
      return () => {
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("ended", () => setIsPlaying(false));
      };
    }
  }, []);

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Audio Waveform</h2>
            <p className="text-sm text-gray-600 mt-1">
              {audioFile.originalName} • {formatTime(audioFile.duration)} duration
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlayPause}
              className="flex items-center space-x-2"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? "Pause" : "Play"}</span>
            </Button>
            {isAddingMarkers && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleAddMarker}
                  className="flex items-center space-x-2 bg-orange-500 hover:bg-orange-600"
                  data-testid="button-add-marker"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Add Marker</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onDoneAddingMarkers}
                  className="flex items-center space-x-2"
                  data-testid="button-done-markers"
                >
                  <Check className="h-4 w-4" />
                  <span>Done Adding</span>
                </Button>
              </>
            )}
            <div className="text-sm text-gray-500 font-mono">
              {formatTime(currentTime)}
            </div>
            {isAddingMarkers && (
              <div className="text-xs text-gray-500">
                {markers.length} markers
              </div>
            )}
          </div>
        </div>

        <audio
          ref={audioRef}
          src={`/api/audio/${audioFile.id}/file`}
          preload="metadata"
        />

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div
            ref={waveformRef}
            className="waveform-container relative h-32 bg-white rounded border cursor-pointer"
            onClick={handleWaveformClick}
          >
            {/* Time markers */}
            <div className="absolute top-0 left-0 right-0 h-6 border-b border-gray-200 flex items-center">
              <div className="relative w-full px-2 text-xs text-gray-500 font-mono">
                {Array.from({ length: Math.min(Math.ceil(audioFile.duration), 20) }, (_, i) => {
                  const time = (i * audioFile.duration) / (Math.min(Math.ceil(audioFile.duration), 20) - 1);
                  const leftPercent = (time / audioFile.duration) * 100;
                  return (
                    <span 
                      key={i} 
                      className="absolute transform -translate-x-1/2"
                      style={{ left: `${leftPercent}%` }}
                    >
                      {Math.floor(time)}s
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Waveform visualization area */}
            <div className="absolute top-6 bottom-0 left-0 right-0 p-2">
              {/* Simplified waveform representation */}
              <div className="h-full bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200 rounded opacity-60" />

              {/* Markers overlay */}
              <div className="absolute top-2 h-full">
                {markers.map((marker, index) => {
                  const leftPercent = (marker.timestamp / audioFile.duration) * 100;
                  
                  return (
                    <div
                      key={index}
                      className="absolute"
                      style={{
                        left: `${leftPercent}%`,
                        top: 0,
                        height: "calc(100% - 16px)",
                        transform: "translateX(-50%)",
                      }}
                    >
                      <div className="w-0.5 h-full bg-orange-500 relative">
                        <div className="absolute -top-1 -left-2 w-4 h-4 bg-orange-500 rounded-full border-2 border-white shadow-sm" />
                        <div className="absolute top-2 -left-3 w-6 h-4 bg-orange-500 text-white text-xs rounded flex items-center justify-center font-medium">
                          {index + 1}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Playback cursor */}
              <div
                className="playback-cursor"
                style={{ left: `${(currentTime / audioFile.duration) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          {isAddingMarkers ? (
            <p>Play the audio and click "Add Marker" to mark important moments. Click "Done Adding" when finished.</p>
          ) : (
            <p>Click on the waveform to seek to a specific time. {markers.length > 0 && `${markers.length} markers added.`}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
