import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ProcessAudioRequest, ProcessingJob } from "@shared/schema";

export function useAudioProcessor() {
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Poll for job status when processing
  const { data: processingJob, isLoading: isProcessing } = useQuery<ProcessingJob>({
    queryKey: ["/api/jobs", currentJobId],
    enabled: !!currentJobId,
    refetchInterval: (data) => {
      if (!data?.data || data.data.status === "completed" || data.data.status === "failed") {
        return false; // Stop polling
      }
      return 1000; // Poll every second
    },
  });

  // Update progress based on job status
  useState(() => {
    if (processingJob) {
      switch (processingJob.status) {
        case "pending":
          setProcessingProgress(10);
          break;
        case "processing":
          setProcessingProgress(65);
          break;
        case "completed":
          setProcessingProgress(100);
          break;
        case "failed":
          setProcessingProgress(0);
          break;
      }
    }
  });

  const processAudio = useCallback(async (request: ProcessAudioRequest) => {
    try {
      const response = await apiRequest("POST", "/api/process", request);
      const result = await response.json();
      setCurrentJobId(result.jobId);
      return result.jobId;
    } catch (error) {
      console.error("Failed to start processing:", error);
      return null;
    }
  }, []);

  const downloadAudio = useCallback((jobId: string) => {
    const link = document.createElement("a");
    link.href = `/api/jobs/${jobId}/download`;
    link.download = `mixed-audio-${jobId}.mp3`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return {
    processAudio,
    downloadAudio,
    processingJob,
    isProcessing: isProcessing && processingJob?.status !== "completed" && processingJob?.status !== "failed",
    processingProgress,
  };
}
