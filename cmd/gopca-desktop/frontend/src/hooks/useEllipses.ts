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

import { useState, useEffect, useRef } from 'react';
import { CalculateEllipses } from '../api/backend';
import { EllipseParams } from '../types';

interface UseEllipsesParams {
  scores?: number[][];
  groupLabels?: string[];
  xComponent: number;
  yComponent: number;
  enabled: boolean;
}

interface UseEllipsesResult {
  ellipses90: Record<string, EllipseParams> | undefined;
  ellipses95: Record<string, EllipseParams> | undefined;
  ellipses99: Record<string, EllipseParams> | undefined;
  isLoading: boolean;
  error: string | null;
}

export function useEllipses({
  scores,
  groupLabels,
  xComponent,
  yComponent,
  enabled
}: UseEllipsesParams): UseEllipsesResult {
  const [ellipses90, setEllipses90] = useState<Record<string, EllipseParams> | undefined>();
  const [ellipses95, setEllipses95] = useState<Record<string, EllipseParams> | undefined>();
  const [ellipses99, setEllipses99] = useState<Record<string, EllipseParams> | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Clear any pending operations
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!enabled || !scores || !groupLabels || groupLabels.length === 0) {
      setEllipses90(undefined);
      setEllipses95(undefined);
      setEllipses99(undefined);
      setError(null);
      return;
    }

    // Validate inputs
    if (scores.length !== groupLabels.length) {
      setError(`Data mismatch: ${scores.length} scores but ${groupLabels.length} labels`);
      return;
    }

    if (scores.length === 0 || !scores[0] || scores[0].length === 0) {
      setError('Invalid scores data');
      return;
    }

    // Debounce the calculation to avoid rapid recalculations
    timeoutRef.current = setTimeout(() => {
      const calculateEllipses = async () => {
        setIsLoading(true);
        setError(null);

        // Create new abort controller for this request
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        try {
          const response = await CalculateEllipses({
            scores,
            groupLabels,
            xComponent,
            yComponent
          });

          // Check if this request was aborted
          if (abortController.signal.aborted) {
            return;
          }

          if (response.success) {
            // The generator types Go maps with optional values; Go never stores
            // an absent value, so the narrower state type is accurate.
            setEllipses90(response.groupEllipses90 as Record<string, EllipseParams>);
            setEllipses95(response.groupEllipses95 as Record<string, EllipseParams>);
            setEllipses99(response.groupEllipses99 as Record<string, EllipseParams>);

            // Check if any ellipses were actually calculated
            const hasAnyEllipses =
              (response.groupEllipses90 && Object.keys(response.groupEllipses90).length > 0) ||
              (response.groupEllipses95 && Object.keys(response.groupEllipses95).length > 0) ||
              (response.groupEllipses99 && Object.keys(response.groupEllipses99).length > 0);

            if (!hasAnyEllipses) {
              setError('No ellipses could be calculated. Groups may have too few points or singular distributions.');
            }
          } else {
            setError(response.error || 'Failed to calculate ellipses');
            setEllipses90(undefined);
            setEllipses95(undefined);
            setEllipses99(undefined);
          }
        } catch (err) {
          // Only set error if not aborted
          if (!abortController.signal.aborted) {
            setError(err instanceof Error ? err.message : 'Failed to calculate ellipses');
            setEllipses90(undefined);
            setEllipses95(undefined);
            setEllipses99(undefined);
          }
        } finally {
          if (!abortController.signal.aborted) {
            setIsLoading(false);
          }
        }
      };

      calculateEllipses();
    }, 100); // 100ms debounce

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [scores, groupLabels, xComponent, yComponent, enabled]);

  return { ellipses90, ellipses95, ellipses99, isLoading, error };
}