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

import { toPng, toSvg } from 'html-to-image';
import { saveAs } from 'file-saver';
import { SaveFile, isWailsEnvironment } from '../api/backend';
import type { ExportFormat } from '@gopca/ui-components';

export const createChartExportHandler = (
  chartRef: React.RefObject<HTMLDivElement>,
  fileName: string,
  theme: 'light' | 'dark'
) => {
  return async (format: ExportFormat) => {
    if (!chartRef.current) {
      throw new Error('Chart reference not available');
    }

    if (format !== 'png' && format !== 'svg') {
      throw new Error(`Unsupported format for chart export: ${format}`);
    }

    let dataUrl: string;

    if (format === 'png') {
      // Wait for fonts to be fully loaded
      await document.fonts.ready;

      // Give charts time to fully render all text elements
      await new Promise(resolve => setTimeout(resolve, 300));

      const chartElement = chartRef.current;
      const bounds = chartElement.getBoundingClientRect();

      dataUrl = await toPng(chartElement, {
        backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF',
        width: bounds.width,
        height: bounds.height,
        pixelRatio: 2,
        cacheBust: true,
        style: {
          fontFamily: '"Nunito", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif'
        }
        // No filter needed for Plotly charts
      });
    } else {
      dataUrl = await toSvg(chartRef.current, {
        backgroundColor: theme === 'dark' ? '#1F2937' : '#FFFFFF'
      });
    }

    if (isWailsEnvironment()) {
      const fullFileName = `${fileName}.${format}`;
      await SaveFile(fullFileName, dataUrl);
    } else {
      if (format === 'png') {
        saveAs(dataUrl, `${fileName}.png`);
      } else {
        const blob = new Blob([dataUrl], { type: 'image/svg+xml' });
        saveAs(blob, `${fileName}.svg`);
      }
    }
  };
};