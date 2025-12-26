export interface FileWithId {
  id: string;
  file: File;
  name: string;
  size: number;
  error?: string;
}

export type OutputFormat = 
  | 'PNG' 
  | 'BMP' 
  | 'EPS' 
  | 'GIF' 
  | 'ICO' 
  | 'JPEG' 
  | 'JPG' 
  | 'SVG' 
  | 'PSD' 
  | 'TGA' 
  | 'TIFF' 
  | 'WEBP';

export type FileSource = 
  | 'From Device' 
  | 'Google Drive' 
  | 'OneDrive' 
  | 'From URL' 
  | 'Dropbox';

export interface ConvertJob {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'completed_with_errors' | 'failed';
  result?: {
    secure_url?: string;
    filePath?: string;
    zipPath?: string;
  };
  errors?: Array<{
    filename: string;
    reason: string;
  }>;
}

