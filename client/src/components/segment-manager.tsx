import { useState } from "react";
import { Plus, Trash2, Clock, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SegmentManagerProps {
  segments: Array<{ startTime: number; endTime: number }>;
  onSegmentsChange: (segments: Array<{ startTime: number; endTime: number }>) => void;
  audioDuration: number;
  onProceedToNext?: () => void;
}

export default function SegmentManager({
  segments,
  onSegmentsChange,
  audioDuration,
  onProceedToNext,
}: SegmentManagerProps) {
  const [errors, setErrors] = useState<Record<number, string>>({});

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return { mins, secs };
  };

  const parseTime = (mins: number, secs: number): number => {
    return (mins || 0) * 60 + (secs || 0);
  };

  const validateSegments = (newSegments: Array<{ startTime: number; endTime: number }>) => {
    const newErrors: Record<number, string> = {};

    newSegments.forEach((segment, index) => {
      // Check if start time is valid
      if (segment.startTime < 0) {
        newErrors[index] = "Start time cannot be negative";
        return;
      }

      // Check if end time is valid
      if (segment.endTime < 0) {
        newErrors[index] = "End time cannot be negative";
        return;
      }

      // Check if start < end
      if (segment.startTime >= segment.endTime) {
        newErrors[index] = "Start time must be less than end time";
        return;
      }

      // Check if times are within audio duration
      if (segment.endTime > audioDuration) {
        newErrors[index] = "End time exceeds audio duration";
        return;
      }

      // Check for overlaps with other segments
      for (let i = 0; i < newSegments.length; i++) {
        if (i === index) continue;
        const other = newSegments[i];
        
        if (
          (segment.startTime >= other.startTime && segment.startTime < other.endTime) ||
          (segment.endTime > other.startTime && segment.endTime <= other.endTime) ||
          (segment.startTime <= other.startTime && segment.endTime >= other.endTime)
        ) {
          newErrors[index] = `Overlaps with segment ${i + 1}`;
          return;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const addSegment = () => {
    const newSegment = { startTime: 0, endTime: Math.min(30, audioDuration) };
    const newSegments = [...segments, newSegment];
    onSegmentsChange(newSegments);
    validateSegments(newSegments);
  };

  const removeSegment = (index: number) => {
    const newSegments = segments.filter((_, i) => i !== index);
    onSegmentsChange(newSegments);
    validateSegments(newSegments);
  };

  const updateSegment = (index: number, field: "startTime" | "endTime", timeType: "mins" | "secs", value: string) => {
    const numValue = parseInt(value) || 0;
    const currentSegment = segments[index];
    const currentTime = formatTime(currentSegment[field]);
    
    let newMins = currentTime.mins;
    let newSecs = currentTime.secs;
    
    if (timeType === "mins") {
      newMins = numValue;
    } else {
      newSecs = Math.min(59, Math.max(0, numValue)); // Clamp seconds to 0-59
    }
    
    const timeValue = parseTime(newMins, newSecs);
    const newSegments = segments.map((segment, i) =>
      i === index ? { ...segment, [field]: timeValue } : segment
    );
    onSegmentsChange(newSegments);
    validateSegments(newSegments);
  };

  const isAllValid = Object.keys(errors).length === 0 && segments.length > 0;
  const totalDuration = segments.reduce((sum, segment) => sum + (segment.endTime - segment.startTime), 0);
  
  const formatTimeDisplay = (seconds: number) => {
    const { mins, secs } = formatTime(seconds);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="mb-8">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Cut Segments</h2>
            <p className="text-sm text-gray-600 mt-1">Define start and end timestamps for each segment</p>
          </div>
          <Button onClick={addSegment} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Add Segment</span>
          </Button>
        </div>

        <div className="space-y-4">
          {segments.map((segment, index) => {
            const hasError = errors[index];
            const duration = segment.endTime - segment.startTime;

            return (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <span className="font-medium text-gray-900">Segment {index + 1}</span>
                    {hasError ? (
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full flex items-center space-x-1">
                        <AlertCircle className="h-3 w-3" />
                        <span>Invalid</span>
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center space-x-1">
                        <CheckCircle className="h-3 w-3" />
                        <span>Valid</span>
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSegment(index)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>Start Time</span>
                    </Label>
                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          value={formatTime(segment.startTime).mins}
                          onChange={(e) => updateSegment(index, "startTime", "mins", e.target.value)}
                          className="font-mono text-sm text-center"
                        />
                        <span className="text-xs text-gray-500 mt-1 block text-center">min</span>
                      </div>
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          max="59"
                          value={formatTime(segment.startTime).secs}
                          onChange={(e) => updateSegment(index, "startTime", "secs", e.target.value)}
                          className="font-mono text-sm text-center"
                        />
                        <span className="text-xs text-gray-500 mt-1 block text-center">sec</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 flex items-center space-x-1">
                      <Clock className="h-3 w-3" />
                      <span>End Time</span>
                    </Label>
                    <div className="flex space-x-2">
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          value={formatTime(segment.endTime).mins}
                          onChange={(e) => updateSegment(index, "endTime", "mins", e.target.value)}
                          className="font-mono text-sm text-center"
                        />
                        <span className="text-xs text-gray-500 mt-1 block text-center">min</span>
                      </div>
                      <div className="flex-1">
                        <Input
                          type="number"
                          placeholder="0"
                          min="0"
                          max="59"
                          value={formatTime(segment.endTime).secs}
                          onChange={(e) => updateSegment(index, "endTime", "secs", e.target.value)}
                          className="font-mono text-sm text-center"
                        />
                        <span className="text-xs text-gray-500 mt-1 block text-center">sec</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2">Duration</Label>
                    <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg font-mono text-sm text-gray-600 text-center">
                      {formatTimeDisplay(duration)}
                    </div>
                  </div>
                </div>

                {hasError && (
                  <div className="mt-3 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{hasError}</span>
                  </div>
                )}
              </div>
            );
          })}

          {segments.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No segments defined yet. Click "Add Segment" to start.</p>
            </div>
          )}

          {/* Validation Summary */}
          {segments.length > 0 && (
            <div className={`border rounded-lg p-4 ${
              isAllValid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-center space-x-2">
                {isAllValid ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-green-900">All segments are valid</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <span className="text-sm font-medium text-red-900">Some segments have errors</span>
                  </>
                )}
              </div>
              {isAllValid && (
                <div className="mt-2 text-sm text-green-700">
                  Total output duration: {formatTimeDisplay(totalDuration)} • No overlapping segments
                </div>
              )}
            </div>
          )}

          {/* Call to Action */}
          {isAllValid && segments.length > 0 && onProceedToNext && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
                <div className="text-sm text-gray-600 text-center sm:text-left">
                  Ready to proceed with <span className="font-medium">{segments.length} segments</span>
                </div>
                <Button onClick={onProceedToNext} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
                  <span>Configure Output</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
