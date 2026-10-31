// GoPCA Suite
//
// Copyright © 2025-2026 Rune Mathisen <devel@bitjungle.com>
//
// This file is part of GoPCA Suite.
//
// GoPCA Suite is source-available software with free binary redistribution.
// Official compiled binary releases may be used and redistributed free of charge
// under the GoPCA Suite Source-Available Freeware License.
//
// The source code is provided for viewing, review, education, security analysis,
// research, interoperability analysis, and evaluation only.
//
// Modification, redistribution, publication, sublicensing, reuse, incorporation
// into another project, or creation of derivative works based on the source code
// is not permitted without prior written permission from the copyright holder.
//
// Usage Restriction: GoPCA Suite may not be used, directly or indirectly, for
// military, warfare, weapons, intelligence, surveillance, targeting, or
// law-enforcement surveillance applications.
//
// See LICENSE for the full license terms.

import React, { useState, useCallback } from 'react';

export interface FileSelectorProps {
  onFileSelect: (filePath: string) => void;
  onBrowseClick?: () => Promise<string | null>;
  isLoading?: boolean;
  acceptedFormats?: string[];
  recentFiles?: string[];
  showDragDrop?: boolean;
  showFormatInfo?: boolean;
  className?: string;
  browseLabel?: string;
  dragDropMessage?: string;
}

const defaultFormats = [
  { ext: '.csv', name: 'Comma-separated values' },
  { ext: '.tsv', name: 'Tab-separated values' },
  { ext: '.xlsx/.xls', name: 'Microsoft Excel' },
  { ext: '.json', name: 'JSON arrays' }
];

export const FileSelector: React.FC<FileSelectorProps> = ({
  onFileSelect,
  onBrowseClick,
  isLoading = false,
  acceptedFormats = ['.csv', '.tsv', '.xlsx', '.xls', '.json'],
  recentFiles = [],
  showDragDrop = true,
  showFormatInfo = true,
  className = '',
  browseLabel = 'Browse Files',
  dragDropMessage = 'Drag and drop files here, or'
}) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleBrowse = useCallback(async () => {
    if (onBrowseClick) {
      try {
        const filePath = await onBrowseClick();
        if (filePath) {
          onFileSelect(filePath);
        }
      } catch (err) {
        console.error('Error selecting file:', err);
      }
    }
  }, [onBrowseClick, onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    // The page never receives the dropped paths: WebKit withholds them from
    // the DOM event, and the host application gets them from Wails on the Go
    // side (GoCSV listens for its files-dropped event and loads the file). So
    // this handler only ends the hover state. preventDefault keeps the
    // webview from navigating to the file. A v2-era alert here claimed drops
    // were unsupported; the runtime used to intercept the event before it
    // arrived, and under Wails v3 it fired on every drop (#1042).
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const filteredFormats = defaultFormats.filter(f =>
    acceptedFormats.some(ext => f.ext.includes(ext))
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {showDragDrop && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <svg
            className={`mx-auto h-12 w-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'} transition-colors`}
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isDragging ? (
              <span className="font-medium text-blue-600 dark:text-blue-400">
                Drop files here
              </span>
            ) : (
              <span>
                {dragDropMessage}{' '}
                <button
                  onClick={handleBrowse}
                  disabled={isLoading || !onBrowseClick}
                  className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 disabled:opacity-50"
                >
                  browse
                </button>
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Supports {filteredFormats.map(f => f.ext).join(', ')} files
          </p>
        </div>
      )}

      <div className="text-center">
        <button
          onClick={handleBrowse}
          disabled={isLoading || !onBrowseClick}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Loading...' : browseLabel}
        </button>
      </div>

      {recentFiles.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Recent Files
          </h3>
          <div className="space-y-1">
            {recentFiles.map((file, index) => (
              <button
                key={index}
                onClick={() => onFileSelect(file)}
                disabled={isLoading}
                className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="truncate">{file}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {showFormatInfo && (
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Supported File Formats
          </h3>
          <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
            {filteredFormats.map((format, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded">
                  {format.ext}
                </span>
                {format.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};