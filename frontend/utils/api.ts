import { ConvertJob } from '@/types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export async function uploadFiles(
  files: File[],
  targetFormat: string
): Promise<{ jobId: string }> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append('files', file);
  });
  formData.append('targetFormat', targetFormat.toLowerCase());

  const response = await fetch(`${API_BASE_URL}/api/convert/image`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || 'Failed to upload files');
  }

  return response.json();
}

export async function getJobStatus(jobId: string): Promise<ConvertJob> {
  const response = await fetch(`${API_BASE_URL}/api/job/${jobId}`);

  if (!response.ok) {
    throw new Error('Failed to get job status');
  }

  return response.json();
}

export async function pollJobStatus(
  jobId: string,
  onUpdate: (job: ConvertJob) => void,
  interval: number = 2000
): Promise<ConvertJob> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const job = await getJobStatus(jobId);
        onUpdate(job);

        if (job.status === 'completed' || job.status === 'completed_with_errors') {
          resolve(job);
        } else if (job.status === 'failed') {
          reject(new Error('Conversion failed'));
        } else {
          setTimeout(poll, interval);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
}

export function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadZip(url: string, filename: string = 'converted.zip'): void {
  downloadFile(url, filename);
}

