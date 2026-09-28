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

// Sample Contribution Plot - Shows which samples contribute most to each PC

import React, { useState, useMemo } from 'react';
import { Plot } from '@gopca/ui-components';
import { useTheme, sampleLabel } from '@gopca/ui-components';
import { PCAResult } from '../../types';
import { usePalette } from '../../contexts/PaletteContext';
import { getQualitativePalette } from '../../utils/colorPalettes';

interface SampleContributionPlotProps {
  pcaResult: PCAResult;
  rowNames?: string[];
  selectedComponent?: number;
  topN?: number;
  fontScale?: number;
  showAllSamples?: boolean;
}

export const SampleContributionPlot: React.FC<SampleContributionPlotProps> = ({
  pcaResult,
  rowNames = [],
  selectedComponent = 0,
  topN = 20,
  fontScale = 1.0,
  showAllSamples = false
}) => {
  const { theme } = useTheme();
  const { qualitativePalette } = usePalette();
  const isDark = theme === 'dark';
  const colorScheme = getQualitativePalette(qualitativePalette);

  // State for component selection
  const [currentComponent, setCurrentComponent] = useState(selectedComponent);

  // Calculate contributions for the selected component.
  // Declared before the early return below so hooks are always called in the
  // same order (react-hooks/rules-of-hooks); it guards the empty case itself.
  const contributions = useMemo(() => {
    const eigenvectors = pcaResult.kernel_eigenvectors;
    if (!eigenvectors || eigenvectors.length === 0) {
      return [];
    }
    const eigenvalue = pcaResult.explained_variance[currentComponent] || 1;

    // Calculate absolute contributions (normalized by eigenvalue)
    const contribData = eigenvectors.map((row, i) => {
      const contribution = Math.abs(row[currentComponent] || 0) * Math.sqrt(eigenvalue);
      const sampleName = sampleLabel(rowNames, i);
      return {
        index: i,
        name: sampleName,
        contribution: contribution,
        originalValue: row[currentComponent] || 0
      };
    });

    // Sort by absolute contribution
    contribData.sort((a, b) => b.contribution - a.contribution);

    // Return top N or all samples
    return showAllSamples ? contribData : contribData.slice(0, topN);
  }, [pcaResult.kernel_eigenvectors, pcaResult.explained_variance, currentComponent, rowNames, topN, showAllSamples]);

  // Check if eigenvectors are available
  if (!pcaResult.kernel_eigenvectors || pcaResult.kernel_eigenvectors.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className={`text-center p-8 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          <p className="text-lg mb-2">Sample contributions not available</p>
          <p className="text-sm">
            Eigenvector data is required to display sample contributions.
          </p>
        </div>
      </div>
    );
  }

  // Prepare data for bar chart
  const trace = {
    x: contributions.map(c => c.name),
    y: contributions.map(c => c.contribution),
    type: 'bar' as const,
    marker: {
      color: contributions.map(c => c.originalValue >= 0 ? colorScheme[0] : colorScheme[1]),
      line: {
        color: isDark ? '#374151' : '#E5E7EB',
        width: 1
      }
    },
    text: contributions.map(c => c.contribution.toFixed(4)),
    textposition: 'outside' as const,
    textfont: {
      size: 10 * fontScale,
      color: isDark ? '#9CA3AF' : '#4B5563'
    },
    hovertemplate:
      '<b>%{x}</b><br>' +
      'Contribution: %{y:.4f}<br>' +
      'Sign: %{customdata}<br>' +
      '<extra></extra>',
    customdata: contributions.map(c => c.originalValue >= 0 ? 'Positive' : 'Negative')
  };

  // Prepare layout
  const layout: any = {
    title: {
      text: `Sample Contributions to ${pcaResult.component_labels?.[currentComponent] || `PC${currentComponent + 1}`}`,
      font: {
        size: 16 * fontScale,
        color: isDark ? '#E5E7EB' : '#1F2937'
      }
    },
    xaxis: {
      title: 'Samples',
      tickangle: -45,
      tickfont: {
        size: 10 * fontScale,
        color: isDark ? '#9CA3AF' : '#4B5563'
      },
      titlefont: {
        size: 12 * fontScale,
        color: isDark ? '#E5E7EB' : '#1F2937'
      },
      gridcolor: isDark ? '#374151' : '#E5E7EB',
      zerolinecolor: isDark ? '#4B5563' : '#9CA3AF'
    },
    yaxis: {
      title: 'Absolute Contribution',
      tickfont: {
        size: 10 * fontScale,
        color: isDark ? '#9CA3AF' : '#4B5563'
      },
      titlefont: {
        size: 12 * fontScale,
        color: isDark ? '#E5E7EB' : '#1F2937'
      },
      gridcolor: isDark ? '#374151' : '#E5E7EB',
      zerolinecolor: isDark ? '#4B5563' : '#9CA3AF'
    },
    paper_bgcolor: isDark ? '#1F2937' : '#FFFFFF',
    plot_bgcolor: isDark ? '#111827' : '#F9FAFB',
    margin: {
      l: 60,
      r: 40,
      t: 80,
      b: 120
    },
    showlegend: false,
    autosize: true
  };

  const config: any = {
    responsive: true,
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['select2d', 'lasso2d'],
    toImageButtonOptions: {
      format: 'png' as const,
      filename: `sample_contributions_pc${currentComponent + 1}`,
      height: 600,
      width: 1000,
      scale: 2
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Component selector */}
      <div className={`p-4 border-b ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'}`}>
        <div className="flex items-center justify-between">
          <label className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Select Component:
          </label>
          <select
            value={currentComponent}
            onChange={(e) => setCurrentComponent(Number(e.target.value))}
            className={`ml-2 px-3 py-1 rounded border ${
              isDark
                ? 'bg-gray-700 border-gray-600 text-gray-200'
                : 'bg-white border-gray-300 text-gray-900'
            }`}
          >
            {pcaResult.component_labels?.map((label, i) => (
              <option key={i} value={i}>
                {label} ({pcaResult.explained_variance_ratio[i]?.toFixed(2)}%)
              </option>
            ))}
          </select>
        </div>

        <div className="mt-2 text-sm">
          <span className={isDark ? 'text-gray-400' : 'text-gray-600'}>
            Showing top {contributions.length} samples by absolute contribution
          </span>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex-1" style={{ minHeight: '400px' }}>
        <Plot
          data={[trace]}
          layout={layout}
          config={config}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler={true}
        />
      </div>
    </div>
  );
};