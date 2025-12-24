import { getNextQueuedJob, setJobProcessing, updateJobStatus, updateJobProgress } from '../queue/convert.queue';
import { processJob } from '../services/jobProcessor.service';

let isProcessing = false; // Prevent double processing
let workerInterval: NodeJS.Timeout | null = null;

const processNextJob = async (): Promise<void> => {
  // Prevent concurrent processing
  if (isProcessing) {
    return;
  }

  try {
    const job = await getNextQueuedJob();
    
    if (!job) {
      return; // No queued jobs
    }

    const { jobId, data } = job;

    // Atomically set to processing
    const acquired = await setJobProcessing(jobId);
    if (!acquired) {
      return; // Another worker picked it up
    }

    isProcessing = true;
    console.log('Worker picked job:', jobId);

    // Initialize progress: 0 files processed
    const totalCount = data.files.length;
    await updateJobProgress(jobId, 0);

    try {
      // Process the job (pass jobId for ZIP naming)
      const result = await processJob(data, jobId);
      
      // Update progress: all files processed
      await updateJobProgress(jobId, totalCount);
      
      // Check if result has status field (partial success)
      const jobStatus = (result as any).status === 'completed_with_errors' 
        ? 'completed_with_errors' 
        : 'completed';
      
      // Update to completed (or completed_with_errors for partial success)
      await updateJobStatus(jobId, jobStatus, result);
      
      if (jobStatus === 'completed_with_errors') {
        console.log(`Job completed with partial success: ${jobId}`);
      } else {
        console.log('Worker completed job:', jobId);
      }
    } catch (error: any) {
      console.error(`Worker failed job ${jobId}:`, error);
      
      // Update to failed
      await updateJobStatus(jobId, 'failed', undefined, error.message || 'Processing failed');
    } finally {
      isProcessing = false;
    }
  } catch (error) {
    console.error('Worker error:', error);
    isProcessing = false;
  }
};

export const startJobWorker = (): void => {
  if (workerInterval) {
    console.log('Job worker already started');
    return;
  }

  console.log('Starting background job worker...');

  // Process jobs every 500ms
  workerInterval = setInterval(() => {
    processNextJob().catch((error) => {
      console.error('Worker loop error:', error);
    });
  }, 500);

  console.log('Job worker started');
};

export const stopJobWorker = (): void => {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('Job worker stopped');
  }
};

