'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import UploadBox from '@/components/UploadBox';
import FileList from '@/components/FileList';
import OutputSettings from '@/components/OutputSettings';
import ConvertButton from '@/components/ConvertButton';
import Footer from '@/components/Footer';
import { FileWithId, OutputFormat, ConvertJob } from '@/types';
import { uploadFiles, pollJobStatus, downloadFile, downloadZip, API_BASE_URL } from '@/utils/api';

export default function Home() {
  const [files, setFiles] = useState<FileWithId[]>([]);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('PNG');
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloadReady, setIsDownloadReady] = useState(false);
  const [jobResult, setJobResult] = useState<ConvertJob | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isFaq2Open, setIsFaq2Open] = useState(false);
  const [isFaq3Open, setIsFaq3Open] = useState(false);
  const [isFaq4Open, setIsFaq4Open] = useState(false);
  const [isFaq5Open, setIsFaq5Open] = useState(false);
  const [isFaq6Open, setIsFaq6Open] = useState(false);
  const [isFaq7Open, setIsFaq7Open] = useState(false);
  const [isFaq8Open, setIsFaq8Open] = useState(false);
  const hasScrolledRef = useRef(false);

  const handleFaq1Toggle = () => {
    setIsFaqOpen(!isFaqOpen);
    if (!isFaqOpen) {
      setIsFaq2Open(false);
      setIsFaq3Open(false);
      setIsFaq4Open(false);
      setIsFaq5Open(false);
      setIsFaq6Open(false);
      setIsFaq7Open(false);
      setIsFaq8Open(false);
    }
  };

  const handleFaq2Toggle = () => {
    setIsFaq2Open(!isFaq2Open);
    if (!isFaq2Open) {
      setIsFaqOpen(false);
      setIsFaq3Open(false);
      setIsFaq4Open(false);
      setIsFaq5Open(false);
      setIsFaq6Open(false);
      setIsFaq7Open(false);
      setIsFaq8Open(false);
    }
  };

  const handleFaq3Toggle = () => {
    setIsFaq3Open(!isFaq3Open);
    if (!isFaq3Open) {
      setIsFaqOpen(false);
      setIsFaq2Open(false);
      setIsFaq4Open(false);
      setIsFaq5Open(false);
      setIsFaq6Open(false);
      setIsFaq7Open(false);
      setIsFaq8Open(false);
    }
  };

  const handleFaq4Toggle = () => {
    setIsFaq4Open(!isFaq4Open);
    if (!isFaq4Open) {
      setIsFaqOpen(false);
      setIsFaq2Open(false);
      setIsFaq3Open(false);
      setIsFaq5Open(false);
      setIsFaq6Open(false);
      setIsFaq7Open(false);
      setIsFaq8Open(false);
    }
  };

  const handleFaq5Toggle = () => {
    setIsFaq5Open(!isFaq5Open);
    if (!isFaq5Open) {
      setIsFaqOpen(false);
      setIsFaq2Open(false);
      setIsFaq3Open(false);
      setIsFaq4Open(false);
      setIsFaq6Open(false);
      setIsFaq7Open(false);
      setIsFaq8Open(false);
    }
  };

  const handleFaq6Toggle = () => {
    setIsFaq6Open(!isFaq6Open);
    if (!isFaq6Open) {
      setIsFaqOpen(false);
      setIsFaq2Open(false);
      setIsFaq3Open(false);
      setIsFaq4Open(false);
      setIsFaq5Open(false);
      setIsFaq7Open(false);
      setIsFaq8Open(false);
    }
  };

  const handleFaq7Toggle = () => {
    setIsFaq7Open(!isFaq7Open);
    if (!isFaq7Open) {
      setIsFaqOpen(false);
      setIsFaq2Open(false);
      setIsFaq3Open(false);
      setIsFaq4Open(false);
      setIsFaq5Open(false);
      setIsFaq6Open(false);
      setIsFaq8Open(false);
    }
  };

  const handleFaq8Toggle = () => {
    setIsFaq8Open(!isFaq8Open);
    if (!isFaq8Open) {
      setIsFaqOpen(false);
      setIsFaq2Open(false);
      setIsFaq3Open(false);
      setIsFaq4Open(false);
      setIsFaq5Open(false);
      setIsFaq6Open(false);
      setIsFaq7Open(false);
    }
  };
  const convertButtonRef = useRef<HTMLDivElement>(null);

  const handleFilesChange = useCallback((newFiles: FileWithId[]) => {
    setFiles(newFiles);
    setIsDownloadReady(false);
    setJobResult(null);
  }, []);

  const handleFileDelete = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setIsDownloadReady(false);
    setJobResult(null);
  }, []);

  const handleConvert = useCallback(async () => {
    if (files.length === 0 || isConverting) return;

    const validFiles = files.filter((f) => !f.error);
    if (validFiles.length === 0) return;

    setIsConverting(true);
    setIsDownloadReady(false);

    try {
      const fileObjects = validFiles.map((f) => f.file);
      const { jobId } = await uploadFiles(fileObjects, outputFormat);

      const job = await pollJobStatus(
        jobId,
        (updatedJob) => {
          setJobResult(updatedJob);
        }
      );

      setJobResult(job);
      setIsDownloadReady(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Conversion failed. Please try again.';
      setRejectionMessage(errorMessage);
      setTimeout(() => setRejectionMessage(null), 5000);
    } finally {
      setIsConverting(false);
    }
  }, [files, outputFormat, isConverting]);

  const handleDownload = useCallback(() => {
    if (!jobResult?.result) return;

    if (jobResult.result.zipPath) {
      // Multiple files - download ZIP
      const zipUrl = `${API_BASE_URL}/api/download/zip/${jobResult.jobId}`;
      downloadZip(zipUrl, 'converted.zip');
    } else if (jobResult.result.secure_url) {
      // Single file - direct download
      const filename = files[0]?.name.split('.')[0] || 'converted';
      const extension = outputFormat.toLowerCase() === 'jpeg' ? 'jpeg' : outputFormat.toLowerCase();
      downloadFile(jobResult.result.secure_url, `${filename}.${extension}`);
    } else if (jobResult.result.filePath) {
      // Local file path (for SVG)
      const downloadUrl = `${API_BASE_URL}${jobResult.result.filePath}`;
      const filename = files[0]?.name.split('.')[0] || 'converted';
      downloadFile(downloadUrl, `${filename}.${outputFormat.toLowerCase()}`);
    }
  }, [jobResult, files, outputFormat]);

  const handleRejectedFiles = useCallback((count: number) => {
    setRejectionMessage(
      `ICO and TGA files are not supported for upload. Please convert them to PNG or JPG first. (${count} file${count > 1 ? 's' : ''} rejected)`
    );
    setTimeout(() => setRejectionMessage(null), 5000);
  }, []);

  const handleMaxFilesReached = useCallback(() => {
    setRejectionMessage('Maximum 10 files can be uploaded at once. Please remove some files to add more.');
    setTimeout(() => setRejectionMessage(null), 5000);
  }, []);

  // Smooth scroll to convert button when files are selected for the first time
  useEffect(() => {
    if (files.length > 0 && !hasScrolledRef.current && convertButtonRef.current) {
      hasScrolledRef.current = true;
      
      // Calculate scroll position: center of viewport + 50% of viewport height
      const viewportCenter = window.innerHeight / 2;
      const scrollOffset = viewportCenter * 0.5; // 50% from center
      const targetPosition = convertButtonRef.current.offsetTop - scrollOffset;
      
      // Smooth scroll with small delay to ensure DOM is ready
      setTimeout(() => {
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }, 100);
    }
    
    // Reset scroll flag when files are cleared
    if (files.length === 0) {
      hasScrolledRef.current = false;
    }
  }, [files.length]);

  return (
    <main className="min-h-screen">
      <Header />
      <div className="pt-[50px]">
        <div className="container mx-auto px-4 pt-[2.793rem] pb-12">
          {/* Title Section */}
          <div className="text-center mb-12">
            <h1 className="text-[3.38256rem] md:text-[4.059072rem] font-bold text-gray-900">
              WebP to PNG
            </h1>
            <p className="text-lg text-gray-600 mt-0.5">
              The best and most advanced way to convert WebP to PNG for free.
            </p>
          </div>

          {/* Rejection Message */}
          {rejectionMessage && (
            <div className="max-w-4xl mx-auto mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">{rejectionMessage}</p>
            </div>
          )}

          {/* Upload Box */}
          <div className="max-w-4xl mx-auto mb-6">
            <UploadBox
              files={files}
              onFilesChange={handleFilesChange}
              onFileDelete={handleFileDelete}
              onRejectedFiles={handleRejectedFiles}
              onMaxFilesReached={handleMaxFilesReached}
            />
          </div>

          {/* File List - Outside Upload Box */}
          {files.length > 0 && (
            <div className="max-w-4xl mx-auto mb-6">
              <div className="w-[90%] mx-auto">
                <FileList 
                  files={files} 
                  onDelete={handleFileDelete}
                  onSettings={(id: string) => {
                    // Settings functionality can be added here if needed
                  }}
                />
              </div>
            </div>
          )}

          {/* Output Settings and Convert Button */}
          {files.length > 0 && (
            <div ref={convertButtonRef} className="max-w-4xl mx-auto">
              <div className="w-[90%] mx-auto flex items-center justify-end gap-4 mb-3">
                <OutputSettings value={outputFormat} onChange={setOutputFormat} />
              </div>
              <div className="w-[90%] mx-auto">
                <ConvertButton
                onClick={handleConvert}
                disabled={isConverting || files.some((f) => f.error)}
                isLoading={isConverting}
                isDownload={isDownloadReady}
                onDownload={handleDownload}
                fileCount={files.length}
              />
              </div>
            </div>
          )}

          {/* Error Display */}
          {jobResult?.errors && jobResult.errors.length > 0 && (
            <div className="max-w-4xl mx-auto mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <h3 className="font-semibold text-red-800 mb-2">Some files failed to convert:</h3>
              <ul className="list-disc list-inside text-sm text-red-700">
                {jobResult.errors.map((error, index) => (
                  <li key={index}>
                    {error.filename}: {error.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* How to Convert Instructions */}
          <div className="max-w-4xl mx-auto mt-12">
            <div className="w-[90%] mx-auto bg-gray-50 border border-gray-200 rounded-lg p-6 opacity-70">
              <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">How to convert WebP to PNG</h2>
              <p className="text-gray-600 mb-6 text-center">Quick and easy conversion in 3 simple steps:</p>
              
              <div className="space-y-6">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <span className="text-gray-800 font-semibold">1. -</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-1">Upload Files</h3>
                    <p className="text-gray-600 text-sm">Drag & drop WebP files or click 'Upload' to select from device.</p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <span className="text-gray-800 font-semibold">2. -</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-1">Convert</h3>
                    <p className="text-gray-600 text-sm">Click 'Convert' button to transform files to PNG format.</p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <span className="text-gray-800 font-semibold">3. -</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800 mb-1">Download</h3>
                    <p className="text-gray-600 text-sm">Single file: Click 'Download'. Multiple files: Click 'Download All' for ZIP.</p>
                  </div>
                </div>
              </div>

              {/* Feature Cards */}
              <div className="mt-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1: Best WebP to PNG Converter */}
                  <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow min-h-[280px] flex flex-col max-w-[280px] mx-auto">
                    <div className="text-4xl mb-4 text-center">🏆</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-3 text-center">Best WebP to PNG Converter</h3>
                    <p className="text-gray-600 text-sm leading-relaxed flex-grow">
                      Convert WebP to PNG with high quality. Our tool ensures excellent transparency and also helps convert animated WebP to PNG. Get reliable results instantly.
                    </p>
                  </div>

                  {/* Card 2: SSL/TLS Encryption */}
                  <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow min-h-[280px] flex flex-col max-w-[280px] mx-auto">
                    <div className="text-4xl mb-4 text-center">🔒</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-3 text-center">SSL/TLS Encryption</h3>
                    <p className="text-gray-600 text-sm leading-relaxed flex-grow">
                      Your privacy is our priority. All file transfers (uploads and downloads) are secured with SSL/TLS encryption, creating a private, encrypted channel between your device and our servers. They are fully protected from third-party access during transfer.
                    </p>
                  </div>

                  {/* Card 3: Free, Fast & Secured */}
                  <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm hover:shadow-md transition-shadow min-h-[280px] flex flex-col max-w-[280px] mx-auto">
                    <div className="text-4xl mb-4 text-center">⚡</div>
                    <h3 className="text-lg font-bold text-gray-800 mb-3 text-center">Free, Fast & Secured</h3>
                    <p className="text-gray-600 text-sm leading-relaxed flex-grow">
                      Experience the difference with our free converter that runs quickly on any web browser. We guarantee file security and privacy. All files are protected by 256-bit SSL encryption and are automatically deleted from our servers within a few hours.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Frequently Asked Questions */}
          <div className="max-w-4xl mx-auto mt-32 mb-8">
            <h2 className="text-3xl font-bold text-gray-800 text-center mb-8">Frequently Asked Questions (FAQs)</h2>
            
            {/* FAQ Item */}
            <div className="w-[90%] mx-auto rounded-lg overflow-hidden">
              <button
                onClick={handleFaq1Toggle}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left relative group"
              >
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gray-200 transition-all duration-500 ease-in-out ${
                    isFaqOpen ? 'opacity-0' : ''
                  }`}
                  style={{
                    background: isFaqOpen 
                      ? 'transparent' 
                      : 'linear-gradient(to top, transparent 0%, rgba(229, 231, 235, 0.3) 30%, rgba(229, 231, 235, 0.6) 60%, rgba(229, 231, 235, 1) 100%)',
                  }}
                ></div>
                <h3 className="text-lg font-semibold text-gray-800 relative z-10">What is WebP image?</h3>
                <svg
                  className={`w-5 h-5 text-gray-600 transition-transform duration-200 relative z-10 ${isFaqOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isFaqOpen && (
                <div className="w-full p-4 bg-white border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed">
                    WebP is a modern image format, developed by Google, designed to make the web faster. It uses smart compression techniques to create significantly smaller, richer images than older formats like JPG or PNG, which drastically improves website load times and saves bandwidth.
                    <br /><br />
                    This versatile format is ideal for modern graphics because it fully supports both transparency and animation.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 2 */}
            <div className="w-[90%] mx-auto rounded-lg overflow-hidden mt-4">
              <button
                onClick={handleFaq2Toggle}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left relative group"
              >
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gray-200 transition-all duration-500 ease-in-out ${
                    isFaq2Open ? 'opacity-0' : ''
                  }`}
                  style={{
                    background: isFaq2Open 
                      ? 'transparent' 
                      : 'linear-gradient(to top, transparent 0%, rgba(229, 231, 235, 0.3) 30%, rgba(229, 231, 235, 0.6) 60%, rgba(229, 231, 235, 1) 100%)',
                  }}
                ></div>
                <h3 className="text-lg font-semibold text-gray-800 relative z-10">What is PNG image?</h3>
                <svg
                  className={`w-5 h-5 text-gray-600 transition-transform duration-200 relative z-10 ${isFaq2Open ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isFaq2Open && (
                <div className="w-full p-4 bg-white border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed">
                    PNG (Portable Network Graphics) is one of the most popular and essential image formats on the internet. It's best known for its ability to handle lossless compression, which means the image quality remains perfect every time the file is saved or opened—you never lose any detail.
                    <br /><br />
                    Most importantly, PNG fully supports transparency (alpha channels). This feature is crucial for web design, allowing logos, icons, and graphics to have smooth, non-jagged edges and blend seamlessly over any background color or image.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 3 */}
            <div className="w-[90%] mx-auto rounded-lg overflow-hidden mt-4">
              <button
                onClick={handleFaq3Toggle}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left relative group"
              >
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gray-200 transition-all duration-500 ease-in-out ${
                    isFaq3Open ? 'opacity-0' : ''
                  }`}
                  style={{
                    background: isFaq3Open 
                      ? 'transparent' 
                      : 'linear-gradient(to top, transparent 0%, rgba(229, 231, 235, 0.3) 30%, rgba(229, 231, 235, 0.6) 60%, rgba(229, 231, 235, 1) 100%)',
                  }}
                ></div>
                <h3 className="text-lg font-semibold text-gray-800 relative z-10">When should you use the WebP format?</h3>
                <svg
                  className={`w-5 h-5 text-gray-600 transition-transform duration-200 relative z-10 ${isFaq3Open ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isFaq3Open && (
                <div className="w-full p-4 bg-white border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed">
                    You should use WebP whenever website performance and loading speed are your primary concern. Since WebP files are significantly smaller than traditional JPGs or PNGs, adopting this format is the best way to reduce page load times, which greatly improves the user experience and boosts your SEO.
                    <br /><br />
                    Moreover, WebP is the ideal choice when you need a single, versatile format that offers high-quality compression along with support for both transparency (like a PNG) and animation (like a GIF). Essentially, if the image is going on the web, using WebP is the smart modern choice.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 4 */}
            <div className="w-[90%] mx-auto rounded-lg overflow-hidden mt-4">
              <button
                onClick={handleFaq4Toggle}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left relative group"
              >
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gray-200 transition-all duration-500 ease-in-out ${
                    isFaq4Open ? 'opacity-0' : ''
                  }`}
                  style={{
                    background: isFaq4Open 
                      ? 'transparent' 
                      : 'linear-gradient(to top, transparent 0%, rgba(229, 231, 235, 0.3) 30%, rgba(229, 231, 235, 0.6) 60%, rgba(229, 231, 235, 1) 100%)',
                  }}
                ></div>
                <h3 className="text-lg font-semibold text-gray-800 relative z-10">When should you use the PNG format?</h3>
                <svg
                  className={`w-5 h-5 text-gray-600 transition-transform duration-200 relative z-10 ${isFaq4Open ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isFaq4Open && (
                <div className="w-full p-4 bg-white border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed">
                    You should use PNG when perfect quality and transparency are critical. It's the best choice for logos, icons, and sharp graphics because it uses lossless compression (meaning zero quality loss) and handles transparent backgrounds flawlessly—something a JPG can't do.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 5 */}
            <div className="w-[90%] mx-auto rounded-lg overflow-hidden mt-4">
              <button
                onClick={handleFaq5Toggle}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left relative group"
              >
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gray-200 transition-all duration-500 ease-in-out ${
                    isFaq5Open ? 'opacity-0' : ''
                  }`}
                  style={{
                    background: isFaq5Open 
                      ? 'transparent' 
                      : 'linear-gradient(to top, transparent 0%, rgba(229, 231, 235, 0.3) 30%, rgba(229, 231, 235, 0.6) 60%, rgba(229, 231, 235, 1) 100%)',
                  }}
                ></div>
                <h3 className="text-lg font-semibold text-gray-800 relative z-10">Is it free to convert WebP to PNG using Love U Convert?</h3>
                <svg
                  className={`w-5 h-5 text-gray-600 transition-transform duration-200 relative z-10 ${isFaq5Open ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isFaq5Open && (
                <div className="w-full p-4 bg-white border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed">
                    Yes, Love U Convert converts WebP to PNG for free.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 6 */}
            <div className="w-[90%] mx-auto rounded-lg overflow-hidden mt-4">
              <button
                onClick={handleFaq6Toggle}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left relative group"
              >
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gray-200 transition-all duration-500 ease-in-out ${
                    isFaq6Open ? 'opacity-0' : ''
                  }`}
                  style={{
                    background: isFaq6Open 
                      ? 'transparent' 
                      : 'linear-gradient(to top, transparent 0%, rgba(229, 231, 235, 0.3) 30%, rgba(229, 231, 235, 0.6) 60%, rgba(229, 231, 235, 1) 100%)',
                  }}
                ></div>
                <h3 className="text-lg font-semibold text-gray-800 relative z-10">Are all my files safe when converting WebP to PNG?</h3>
                <svg
                  className={`w-5 h-5 text-gray-600 transition-transform duration-200 relative z-10 ${isFaq6Open ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isFaq6Open && (
                <div className="w-full p-4 bg-white border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed">
                    Yes, Love U Convert's WebP to PNG converter secures all file transfers (uploads and downloads) with SSL/TLS encryption.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 7 */}
            <div className="w-[90%] mx-auto rounded-lg overflow-hidden mt-4">
              <button
                onClick={handleFaq7Toggle}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left relative group"
              >
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gray-200 transition-all duration-500 ease-in-out ${
                    isFaq7Open ? 'opacity-0' : ''
                  }`}
                  style={{
                    background: isFaq7Open 
                      ? 'transparent' 
                      : 'linear-gradient(to top, transparent 0%, rgba(229, 231, 235, 0.3) 30%, rgba(229, 231, 235, 0.6) 60%, rgba(229, 231, 235, 1) 100%)',
                  }}
                ></div>
                <h3 className="text-lg font-semibold text-gray-800 relative z-10">Do I need to install any software/app to convert WebP to PNG?</h3>
                <svg
                  className={`w-5 h-5 text-gray-600 transition-transform duration-200 relative z-10 ${isFaq7Open ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isFaq7Open && (
                <div className="w-full p-4 bg-white border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed">
                    No, you don't need to install any software/app to convert WebP to PNG. The conversion happens directly in your web browser.
                  </p>
                </div>
              )}
            </div>

            {/* FAQ Item 8 */}
            <div className="w-[90%] mx-auto rounded-lg overflow-hidden mt-4">
              <button
                onClick={handleFaq8Toggle}
                className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50 transition-colors text-left relative group"
              >
                <div 
                  className={`absolute bottom-0 left-0 right-0 h-[1px] bg-gray-200 transition-all duration-500 ease-in-out ${
                    isFaq8Open ? 'opacity-0' : ''
                  }`}
                  style={{
                    background: isFaq8Open 
                      ? 'transparent' 
                      : 'linear-gradient(to top, transparent 0%, rgba(229, 231, 235, 0.3) 30%, rgba(229, 231, 235, 0.6) 60%, rgba(229, 231, 235, 1) 100%)',
                  }}
                ></div>
                <h3 className="text-lg font-semibold text-gray-800 relative z-10">Can I convert multiple WebP files to PNG at once?</h3>
                <svg
                  className={`w-5 h-5 text-gray-600 transition-transform duration-200 relative z-10 ${isFaq8Open ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              {isFaq8Open && (
                <div className="w-full p-4 bg-white border-t border-gray-200">
                  <p className="text-gray-600 leading-relaxed">
                    Absolutely! Our tool is built for maximum efficiency and handles batch conversions effortlessly.
                    <br /><br />
                    You can upload as many WebP files as you need simultaneously. Once the conversion is done:
                    <br /><br />
                    If you uploaded just one file, you can download the resulting PNG directly.
                    <br /><br />
                    If you uploaded multiple files, the tool automatically bundles all your new PNGs into a single, convenient ZIP file for quick download.
                    <br /><br />
                    This saves you a ton of time compared to converting images one by one!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}

