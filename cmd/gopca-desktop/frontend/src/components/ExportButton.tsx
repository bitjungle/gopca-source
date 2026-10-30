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

import React from 'react';
import { toPng, toSvg } from 'html-to-image';
import { saveAs } from 'file-saver';
import { SaveFile, isWailsEnvironment } from '../api/backend';
import { ExportButton as SharedExportButton, useTheme, type ExportConfig } from '@gopca/ui-components';

interface ChartExportButtonProps {
  chartRef: React.RefObject<HTMLDivElement>;
  fileName: string;
  className?: string;
}

export const ExportButton: React.FC<ChartExportButtonProps> = ({ chartRef, fileName, className = '' }) => {
  const { theme } = useTheme();

  const handleExportPNG = async () => {
    if (!chartRef.current) {
      throw new Error('Chart element not found');
    }

    // Wait for fonts to be fully loaded
    await document.fonts.ready;

    // Give Plotly time to fully render all text elements
    await new Promise(resolve => setTimeout(resolve, 300));

    // Get the chart element and its bounds
    const chartElement = chartRef.current;
    const bounds = chartElement.getBoundingClientRect();

    const dataUrl = await toPng(chartElement, {
      backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
      width: bounds.width,
      height: bounds.height,
      pixelRatio: 2,
      cacheBust: true,
      style: {
        fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
      }
    });

    // Check if we're in Wails environment
    if (isWailsEnvironment()) {
      // Use Wails backend for saving
      await SaveFile(`${fileName}.png`, dataUrl);
    } else {
      // Fallback to browser download for development
      saveAs(dataUrl, `${fileName}.png`);
    }
  };

  const handleExportSVG = async () => {
    if (!chartRef.current) {
      throw new Error('Chart element not found');
    }

    const dataUrl = await toSvg(chartRef.current, {
      backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF'
    });

    // Check if we're in Wails environment
    if (isWailsEnvironment()) {
      // Use Wails backend for saving
      await SaveFile(`${fileName}.svg`, dataUrl);
    } else {
      // Fallback to browser download for development
      const blob = new Blob([dataUrl], { type: 'image/svg+xml' });
      saveAs(blob, `${fileName}.svg`);
    }
  };

  const exportFormats: ExportConfig[] = [
    {
      format: 'png',
      label: 'Export as PNG',
      handler: handleExportPNG
    },
    {
      format: 'svg',
      label: 'Export as SVG',
      handler: handleExportSVG
    }
  ];

  return (
    <SharedExportButton
      formats={exportFormats}
      label="Export"
      className={className}
      size="md"
    />
  );
};