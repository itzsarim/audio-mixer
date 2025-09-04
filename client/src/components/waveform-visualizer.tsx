import { useEffect, useRef, useState } from "react";
import { Play, Pause, MapPin, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AudioFile } from "@shared/schema";

interface WaveformVisualizerProps {
  audioFile: AudioFile;
  audioSrc: string; // local blob URL
  markers: Array<{ timestamp: number; order: number }>;
  onMarkersChange: (markers: Array<{ timestamp: number; order: number }>) => void;
  isAddingMarkers: boolean;
  onDoneAddingMarkers: () => void;
}

export default function WaveformVisualizer({
  audioFile,
  audioSrc,
  markers,
  onMarkersChange,
  isAddingMarkers,
  onDoneAddingMarkers,
}: WaveformVisualizerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(audioFile.duration);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent) => {
    if (!containerRef.current || !audioRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = Math.max(0, Math.min(percentage * duration, duration));
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleAddMarker = () => {
    if (!audioRef.current) return;
    
    const timestamp = Math.floor(audioRef.current.currentTime * 10) / 10; // Round to 1 decimal
    
    // Check if marker already exists at this timestamp (within 0.5 seconds)
    const existingMarker = markers.find(m => Math.abs(m.timestamp - timestamp) < 0.5);
    if (existingMarker) {
      return; // Don't add duplicate markers
    }
    
    const newMarkers = [...markers, { timestamp, order: markers.length }];
    onMarkersChange(newMarkers);
  };

  // Generate time scale markers (every 10 seconds for long tracks, every 5 for short)
  const generateTimeScale = () => {
    const interval = duration > 120 ? 10 : duration > 60 ? 5 : 2;
    const timeMarkers = [];
    
    for (let time = 0; time <= duration; time += interval) {
      if (time > duration) break;
      const percentage = (time / duration) * 100;
      timeMarkers.push({
        time,
        percentage,
        label: `${Math.floor(time)}s`
      });
    }
    
    return timeMarkers;
  };

  const timeScale = generateTimeScale();
  const sortedMarkers = [...markers].sort((a, b) => a.timestamp - b.timestamp);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener("timeupdate", handleTimeUpdate);
      audio.addEventListener("loadedmetadata", handleLoadedMetadata);
      audio.addEventListener("ended", () => setIsPlaying(false));
      
      return () => {
        audio.removeEventListener("timeupdate", handleTimeUpdate);
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
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
              {audioFile.originalName} • {formatTime(duration)} duration
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlayPause}
              className="flex items-center space-x-2"
              data-testid="button-play-pause"
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

        <audio ref={audioRef} src={audioSrc} preload="metadata" />

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div
            ref={containerRef}
            className="relative h-32 bg-white rounded border cursor-pointer"
            onClick={handleWaveformClick}
          >
            {/* Time scale at the top */}
            <div className="absolute top-0 left-0 right-0 h-6 border-b border-gray-200">
              <div className="relative h-full">
                {timeScale.map((marker, index) => (
                  <div
                    key={index}
                    className="absolute top-0 h-full flex flex-col items-center"
                    style={{ left: `${marker.percentage}%` }}
                  >
                    <div className="w-px h-2 bg-gray-300"></div>
                    <span className="text-xs text-gray-500 font-mono mt-1">
                      {marker.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Waveform visualization area */}
            <div className="absolute top-6 bottom-0 left-0 right-0">
              {/* Waveform background */}
              <div className="h-full bg-gradient-to-r from-blue-200 via-blue-300 to-blue-200 rounded opacity-60" />
              
              {/* Current time playback cursor */}
              <div
                className="absolute top-0 h-full w-0.5 bg-red-500 z-20 pointer-events-none"
                style={{ left: `${(currentTime / duration) * 100}%` }}
              >
                <div className="absolute -top-1 -left-1 w-2 h-2 bg-red-500 rounded-full"></div>
              </div>

              {/* Audio markers */}
              {sortedMarkers.map((marker, index) => {
                const leftPercentage = (marker.timestamp / duration) * 100;
                const isStartMarker = index % 2 === 0;
                
                return (
                  <div
                    key={`${marker.timestamp}-${index}`}
                    className="absolute top-0 h-full z-10 pointer-events-none"
                    style={{ left: `${leftPercentage}%` }}
                  >
                    {/* Marker line */}
                    <div className={`w-0.5 h-full ${isStartMarker ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    
                    {/* Marker dot */}
                    <div className={`absolute -top-1 -left-1.5 w-3 h-3 rounded-full border-2 border-white shadow-sm ${
                      isStartMarker ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    
                    {/* Marker label */}
                    <div className={`absolute -top-6 -left-4 px-1 py-0.5 text-xs font-medium text-white rounded ${
                      isStartMarker ? 'bg-green-500' : 'bg-red-500'
                    }`}>
                      {isStartMarker ? 'S' : 'E'}{Math.floor(index / 2) + 1}
                    </div>
                    
                    {/* Timestamp label */}
                    <div className="absolute top-full mt-1 -left-6 text-xs text-gray-600 font-mono whitespace-nowrap">
                      {formatTime(marker.timestamp)}
                    </div>
                  </div>
                );
              })}
              
              {/* Segment overlays */}
              {sortedMarkers.length >= 2 && 
                Array.from({ length: Math.floor(sortedMarkers.length / 2) }, (_, segmentIndex) => {
                  const startMarker = sortedMarkers[segmentIndex * 2];
                  const endMarker = sortedMarkers[segmentIndex * 2 + 1];
                  
                  if (!startMarker || !endMarker) return null;
                  
                  const startPercent = (startMarker.timestamp / duration) * 100;
                  const endPercent = (endMarker.timestamp / duration) * 100;
                  const width = endPercent - startPercent;
                  
                  return (
                    <div
                      key={`segment-${segmentIndex}`}
                      className="absolute top-0 h-full bg-yellow-200 opacity-30 pointer-events-none"
                      style={{
                        left: `${startPercent}%`,
                        width: `${width}%`,
                      }}
                    >
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-xs font-semibold text-gray-700 bg-white bg-opacity-75 px-1 rounded">
                        Seg {segmentIndex + 1}
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          {isAddingMarkers ? (
            <p>Play the audio and click "Add Marker" to set start/end points for segments. Each pair of markers creates one segment.</p>
          ) : (
            <p>
              Click on the waveform to seek to a specific time. 
              {markers.length > 0 && (
                <span>
                  {" "}• {markers.length} markers added 
                  ({Math.floor(markers.length / 2)} segments)
                </span>
              )}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}