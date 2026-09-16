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

import React, { useEffect, useState } from 'react';
import { PCAResult } from '../types';
import { CalculateModelMetrics } from '../../wailsjs/go/main/App';
import { HelpWrapper } from '@gopca/ui-components';

interface ModelOverviewProps {
  pcaResult: PCAResult;
  selectedPC?: number;
  standardScale?: boolean;
  robustScale?: boolean;
  originalData?: number[][];
}

interface ModelMetrics {
  mostInfluentialVariable: string;
  loadingValue: number;
  recommendedComponents: number;
  varianceCaptured: number;
  kaiserComponents: number;
  kaiserCensored: boolean;
  scaleRatio: number;
  scaleWarning?: string;
}

export const ModelOverview: React.FC<ModelOverviewProps> = ({ pcaResult, selectedPC = 0, standardScale = false, robustScale = false, originalData }) => {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!pcaResult) {
        setLoading(false);
        return;
      }

      // Skip backend call for Kernel PCA - we'll handle it client-side
      if (pcaResult.method === 'kernel') {
        setLoading(false);
        return;
      }

      if (!pcaResult.loadings) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await CalculateModelMetrics({
          loadings: pcaResult.loadings,
          explainedVariance: pcaResult.explained_variance_ratio,
          variableLabels: pcaResult.variable_labels || [],
          selectedPC: selectedPC,
          standardScale: standardScale,
          robustScale: robustScale,
          originalData: originalData || []
        });

        if (response.success) {
          setMetrics({
            mostInfluentialVariable: response.mostInfluentialVariable,
            loadingValue: response.loadingValue,
            recommendedComponents: response.recommendedComponents,
            varianceCaptured: response.varianceCaptured,
            kaiserComponents: response.kaiserComponents,
            kaiserCensored: response.kaiserCensored,
            scaleRatio: response.scaleRatio,
            scaleWarning: response.scaleWarning
          });
        } else {
          setError(response.error || 'Failed to calculate metrics');
        }
      } catch (err) {
        setError('Failed to calculate model metrics');
        console.error('Error calculating model metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [pcaResult, selectedPC, standardScale, robustScale, originalData]);

  // Render special Kernel PCA overview
  if (pcaResult?.method === 'kernel') {
    const kernelType = pcaResult.kernel_type || 'unknown';
    const kernelParams = pcaResult.kernel_params || {};
    const nComponents = pcaResult.components_computed;
    // Removed unused: const totalVariance = pcaResult.cumulative_variance?.[nComponents - 1] || 0;

    // Get the first few eigenvalues for display
    const firstPC = pcaResult.explained_variance_ratio?.[0] || 0;
    const secondPC = pcaResult.explained_variance_ratio?.[1] || 0;
    const thirdPC = pcaResult.explained_variance_ratio?.[2] || 0;

    // Format kernel parameters for display
    const formatKernelParams = () => {
      switch (kernelType) {
        case 'rbf':
          return `γ = ${kernelParams.gamma?.toFixed(4) || 'auto'}`;
        case 'polynomial':
          return `degree = ${kernelParams.degree || 3}, γ = ${kernelParams.gamma?.toFixed(4) || 'auto'}`;
        case 'linear':
          return 'no parameters';
        default:
          return '';
      }
    };

    // Get kernel description
    const getKernelDescription = () => {
      switch (kernelType) {
        case 'rbf':
          return 'Radial Basis Function';
        case 'polynomial':
          return 'Polynomial';
        case 'linear':
          return 'Linear';
        default:
          return 'Unknown';
      }
    };

    return (
      <HelpWrapper helpKey="model-overview">
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 h-full flex flex-col">
          <div className="mb-2">
            <h3 className="text-lg font-semibold">Model Overview</h3>
          </div>
          <div className="space-y-2 flex-grow">
            <HelpWrapper helpKey="kernel-type">
              <div className="flex justify-between items-start">
                <span>Kernel:</span>
                <div className="text-right">
                  <span className="font-medium">
                    {getKernelDescription()}
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatKernelParams()}
                  </div>
                </div>
              </div>
            </HelpWrapper>

            <HelpWrapper helpKey="kernel-components">
              <div className="flex justify-between items-start">
                <span>Components:</span>
                <div className="text-right">
                  <span className="font-medium">
                    {nComponents} computed
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    PC1: {firstPC.toFixed(1)}% variance
                  </div>
                </div>
              </div>
            </HelpWrapper>

            <HelpWrapper helpKey="kernel-variance">
              <div className="flex justify-between items-start">
                <span>Top 3 PCs:</span>
                <div className="text-right">
                  <span className="font-medium">
                    {(firstPC + secondPC + thirdPC).toFixed(1)}%
                  </span>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    cumulative variance
                  </div>
                </div>
              </div>
            </HelpWrapper>

            {pcaResult.kernel_matrix && (
              <HelpWrapper helpKey="kernel-matrix-size">
                <div className="flex justify-between items-start">
                  <span>Kernel matrix:</span>
                  <div className="text-right">
                    <span className="font-medium">
                      {pcaResult.kernel_matrix.length} × {pcaResult.kernel_matrix.length}
                    </span>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      similarity matrix
                    </div>
                  </div>
                </div>
              </HelpWrapper>
            )}
          </div>
        </div>
      </HelpWrapper>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 h-full">
        <h3 className="text-lg font-semibold mb-3">Model Overview</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 h-full">
        <h3 className="text-lg font-semibold mb-3">Model Overview</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {error || 'Unable to calculate metrics'}
        </p>
      </div>
    );
  }

  // Format the recommendation subtitle
  const getRecommendationSubtitle = () => {
    if (!metrics) {
return '';
}

    const varianceText = `${metrics.varianceCaptured.toFixed(1)}% variance`;

    // A censored count is not a verdict. Every computed eigenvalue exceeded 1,
    // so the criterion was still selecting when the components ran out -- and
    // because recommendedComponents falls back to that same count when the
    // variance target is never met, the two matched and the panel announced
    // agreement with a recommendation Kaiser was arguing against (#956).
    if (standardScale && metrics.kaiserCensored) {
      return `${varianceText} (Kaiser: ${metrics.kaiserComponents}+, try more components)`;
    }
    // If standardized and Kaiser is available and matches, show it
    if (standardScale && metrics.kaiserComponents > 0 && metrics.kaiserComponents === metrics.recommendedComponents) {
      return `${varianceText} (Kaiser agrees)`;
    } else if (standardScale && metrics.kaiserComponents > 0) {
      return `${varianceText} (Kaiser: ${metrics.kaiserComponents})`;
    }

    return varianceText;
  };

  return (
    <HelpWrapper helpKey="model-overview">
      <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 h-full flex flex-col">
        <div className="mb-2">
          <h3 className="text-lg font-semibold">Model Overview</h3>
        </div>
        <div className="space-y-2 flex-grow">
          <HelpWrapper helpKey="most-influential-variable">
            <div className="flex justify-between items-start">
              <span>Top variable:</span>
              <div className="text-right">
                <span className="font-medium">
                  {metrics.mostInfluentialVariable}
                </span>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Loading: {metrics.loadingValue.toFixed(3)}
                </div>
              </div>
            </div>
          </HelpWrapper>

          <HelpWrapper helpKey="recommended-components">
            <div className="flex justify-between items-start">
              <span>
                Recommended:
                {metrics.scaleWarning && (
                  <span className="ml-1 text-yellow-600 dark:text-yellow-500" title={metrics.scaleWarning}>
                    ⚠️
                  </span>
                )}
              </span>
              <div className="text-right">
                <span className="font-medium">
                  {metrics.recommendedComponents} components
                </span>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {getRecommendationSubtitle()}
                </div>
              </div>
            </div>
          </HelpWrapper>

          <HelpWrapper helpKey="variance-captured">
            <div className="flex justify-between items-start">
              <span>Variance captured:</span>
              <div className="text-right">
                <span className="font-medium">
                  {metrics.varianceCaptured.toFixed(1)}%
                </span>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  by {metrics.recommendedComponents} PC{metrics.recommendedComponents !== 1 ? 's' : ''}
                </div>
              </div>
            </div>
          </HelpWrapper>

          {/* Show scale warning if present */}
          {metrics.scaleWarning && (
            <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-xs text-yellow-800 dark:text-yellow-200">
              ⚠️ {metrics.scaleWarning}
            </div>
          )}
        </div>
      </div>
    </HelpWrapper>
  );
};