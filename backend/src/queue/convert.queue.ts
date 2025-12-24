import { randomBytes } from 'crypto';

export interface ConvertJobData {
  files: Array<{
    filename: string;
    mimeType: string | null;
    detectedMime: string | null;
    size: number;
    tempPath: string; // File path on disk instead of buffer
    targetFormat?: string;
  }>;
  targetFormat: string;
  clientIP: string;
  quotaLimit: number;
  quotaUsed: number;
}

interface JobStore {
  status: 'queued' | 'processing' | 'completed' | 'completed_with_errors' | 'failed';
  data: ConvertJobData;
  result?: any;
  error?: string;
  createdAt: number;
  processedCount?: number;
  totalCount?: number;
}

// In-memory job storage
const jobs = new Map<string, JobStore>();

// Clean up old jobs (older than 24 hours)
const JOB_TTL_MS = 86400000; // 24 hours in milliseconds
setInterval(() => {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      jobs.delete(jobId);
    }
  }
}, 3600000); // Run cleanup every hour

export const createJob = async (jobData: ConvertJobData): Promise<string> => {
  // Generate random jobId (uuid-like)
  const jobId = `${Date.now()}_${randomBytes(8).toString('hex')}`;

  const jobStore: JobStore = {
    status: 'queued',
    data: jobData,
    createdAt: Date.now(),
    processedCount: 0,
    totalCount: jobData.files.length,
  };

  // Store job in in-memory Map
  jobs.set(jobId, jobStore);

  return jobId;
};

export const getJob = async (jobId: string): Promise<JobStore | null> => {
  const job = jobs.get(jobId);
  return job || null;
};

export const updateJobStatus = async (
  jobId: string,
  status: JobStore['status'],
  result?: any,
  error?: string
): Promise<boolean> => {
  const existing = jobs.get(jobId);

  if (!existing) {
    return false;
  }

  const updated: JobStore = {
    ...existing,
    status,
    ...(result !== undefined && { result }),
    ...(error !== undefined && { error }),
  };

  jobs.set(jobId, updated);

  return true;
};

export const updateJobProgress = async (
  jobId: string,
  processedCount: number
): Promise<boolean> => {
  const existing = jobs.get(jobId);

  if (!existing) {
    return false;
  }

  existing.processedCount = processedCount;
  jobs.set(jobId, existing);

  return true;
};

export const getNextQueuedJob = async (): Promise<{ jobId: string; data: ConvertJobData } | null> => {
  // Find first job with status 'queued'
  for (const [jobId, job] of jobs.entries()) {
    if (job.status === 'queued') {
      return {
        jobId,
        data: job.data,
      };
    }
  }
  return null;
};

export const setJobProcessing = async (jobId: string): Promise<boolean> => {
  const existing = jobs.get(jobId);

  if (!existing) {
    return false;
  }

  // Atomic check-and-set
  if (existing.status !== 'queued') {
    return false;
  }

  existing.status = 'processing';
  jobs.set(jobId, existing);

  return true;
};
