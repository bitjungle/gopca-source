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
import { MarkdownRenderer } from '@gopca/ui-components';
import { Browser } from '../api/backend';

/**
 * Maps a dataset name to the public path of its tutorial markdown file.
 * Tutorial files live under frontend/public/tutorials/<dataset>/.
 * Entries for datasets whose tutorial is not yet written (#657) are
 * intentionally omitted — a missing entry produces the "No tutorial available"
 * message instead of a 404 fetch error.
 */
const TUTORIAL_PATHS: Record<string, string> = {
  iris:       '/tutorials/iris/iris_exploration.md',
  wine:       '/tutorials/wine/wine_exploration.md',
  corn:       '/tutorials/corn/corn_exploration.md',
  swiss_roll:    '/tutorials/swiss_roll/swiss_roll_exploration.md',
  cstr:          '/tutorials/cstr/cstr_exploration.md',
  eeg_eye_state: '/tutorials/eeg_eye_state/eeg_eye_state_exploration.md',
  body_measures: '/tutorials/body_measures/body_measures_exploration.md'
};

interface TutorialViewerProps {
  /** Dataset name as returned by GetAppMode().Dataset */
  dataset: string;
}

/**
 * TutorialViewer renders a dataset exploration tutorial in the tutorial window.
 *
 * It fetches the markdown file from the embedded asset server, rewrites
 * relative image paths to absolute public paths, then renders using the
 * shared MarkdownRenderer component.
 *
 * This component is rendered by App.tsx when GetAppMode() returns
 * mode "tutorial". It is never shown in the main application window.
 */
export const TutorialViewer: React.FC<TutorialViewerProps> = ({ dataset }) => {
  const [content, setContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const tutorialPath = TUTORIAL_PATHS[dataset];
  // Base directory for resolving relative assets (e.g. images)
  const assetBase = `/tutorials/${dataset}/`;

  useEffect(() => {
    // Reset state at the start of each effect run so that if dataset ever
    // changes the component does not show stale content or a stale error.
    setContent('');
    setError(null);

    if (!tutorialPath) {
      setError(`No tutorial available yet for dataset: ${dataset}`);
      return;
    }

    fetch(tutorialPath)
      .then(response => {
        if (!response.ok) {
          // Treat 404 the same as a missing TUTORIAL_PATHS entry — the
          // tutorial file simply hasn't been written yet.
          if (response.status === 404) {
            setError(`No tutorial available yet for dataset: ${dataset}`);
          } else {
            setError(`Could not load tutorial (HTTP ${response.status})`);
          }
          return null;
        }
        return response.text();
      })
      .then(text => {
        if (text === null) return;
        // Rewrite relative image references like ./foo.png to absolute paths
        // so MarkdownRenderer can load them from the embedded asset server.
        const resolved = text.replace(/\(\.\/([^)]+)\)/g, `(${assetBase}$1)`);
        setError(null);
        setContent(resolved);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Could not load tutorial: ${message}`);
      });
  }, [tutorialPath, assetBase, dataset]);

  if (error) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">{error}</p>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <p className="text-gray-500 dark:text-gray-400">Loading tutorial…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-auto">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <MarkdownRenderer content={content} onExternalLink={Browser.OpenURL} />
      </div>
    </div>
  );
};
