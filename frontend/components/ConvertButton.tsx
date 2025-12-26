'use client';

interface ConvertButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  isDownload?: boolean;
  onDownload?: () => void;
  fileCount?: number;
}

export default function ConvertButton({
  onClick,
  disabled = false,
  isLoading = false,
  isDownload = false,
  onDownload,
  fileCount = 1,
}: ConvertButtonProps) {
  const handleClick = () => {
    if (isDownload && onDownload) {
      onDownload();
    } else {
      onClick();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={`w-full h-[55.2px] rounded-md font-semibold text-white transition-all duration-200 ${
        isDownload
          ? 'bg-green-600 hover:bg-green-700'
          : 'bg-[#7C3AED] hover:bg-[#6D28D9]'
      } disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:ring-offset-2`}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <svg
            className="animate-spin h-5 w-5"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          Converting...
        </span>
      ) : isDownload ? (
        fileCount > 1 ? 'Download All' : 'Download'
      ) : (
        fileCount > 1 ? 'Convert All' : 'Convert'
      )}
    </button>
  );
}

