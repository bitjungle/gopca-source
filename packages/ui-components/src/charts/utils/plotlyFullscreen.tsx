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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import Plot from '../plotly-component';

/**
 * Fullscreen overlay container for Plotly visualizations
 * Fills the entire GoPCA application window
 */
export const PlotlyFullscreenModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  plotData: any;
  plotLayout: any;
  plotConfig: any;
}> = ({ isOpen, onClose, plotData, plotLayout, plotConfig }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Force Plotly to resize when modal opens
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const plotDiv = modalRef.current.querySelector('.js-plotly-plot') as any;
      if (plotDiv && window.Plotly) {
        setTimeout(() => {
          window.Plotly.Plots.resize(plotDiv);
        }, 100);
      }
    }
  }, [isOpen]);

  if (!isOpen) {
return null;
}

  // Enhanced config with exit fullscreen button
  // Ensure modebar is visible and add the fullscreen toggle button
  const enhancedConfig = {
    ...plotConfig,
    displayModeBar: true, // Ensure modebar is visible
    displaylogo: false,
    modeBarButtonsToAdd: [
      ...(plotConfig.modeBarButtonsToAdd || []).filter(
        (btn: any) => btn.name !== 'fullscreen' // Remove existing fullscreen button
      ),
      createFullscreenButton(onClose) // Add toggle button that exits fullscreen
    ]
  };

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[999999] bg-white dark:bg-gray-900" style={{ zIndex: 999999 }}>
      {/* Plot container with padding to ensure modebar is visible */}
      <div ref={modalRef} className="w-full h-full relative pt-12">
        <Plot
          data={plotData}
          layout={{
            ...plotLayout,
            autosize: true
          }}
          config={enhancedConfig}
          style={{ width: '100%', height: 'calc(100% - 3rem)' }}
          useResizeHandler={true}
        />
      </div>
    </div>,
    document.body
  );
};

/**
 * Hook to add fullscreen functionality to Plotly plots
 */
export const usePlotlyFullscreen = (data: any, layout: any, config: any) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const openFullscreen = useCallback(() => {
    setIsFullscreen(true);
  }, []);

  const closeFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  const fullscreenModal = (
    <PlotlyFullscreenModal
      isOpen={isFullscreen}
      onClose={closeFullscreen}
      plotData={data}
      plotLayout={layout}
      plotConfig={config}
    />
  );

  return {
    isFullscreen,
    openFullscreen,
    closeFullscreen,
    fullscreenModal
  };
};

/**
 * Create a custom fullscreen button for Plotly's modebar
 */
export const createFullscreenButton = (onClick: () => void) => {
  return {
    name: 'fullscreen',
    title: 'Toggle fullscreen',
    icon: {
      width: 1000,
      height: 1000,
      path: 'M250 250 L250 500 L500 500 M750 250 L750 500 L500 500 M250 750 L250 500 L500 500 M750 750 L750 500 L500 500',
      transform: 'matrix(1 0 0 1 0 0)'
    },
    click: onClick
  };
};

/**
 * Wrapper component that adds fullscreen capability to Plotly plots
 */
export const PlotlyWithFullscreen: React.FC<{
  data: any;
  layout: any;
  config: any;
  style?: React.CSSProperties;
  onSelected?: (event: any) => void;
  onDeselect?: () => void;
}> = ({ data, layout, config, style, onSelected, onDeselect }) => {
  const { openFullscreen, fullscreenModal } = usePlotlyFullscreen(data, layout, config);

  // Add fullscreen button to modebar
  const enhancedConfig = {
    ...config,
    modeBarButtonsToAdd: [
      ...(config.modeBarButtonsToAdd || []),
      createFullscreenButton(openFullscreen)
    ]
  };

  return (
    <>
      <Plot
        data={data}
        layout={layout}
        config={enhancedConfig}
        style={style || { width: '100%', height: '100%' }}
        useResizeHandler={true}
        onSelected={onSelected}
        onDeselect={onDeselect as any}
      />
      {fullscreenModal}
    </>
  );
};

// Type declaration for Plotly global
declare global {
  interface Window {
    Plotly: any;
  }
}