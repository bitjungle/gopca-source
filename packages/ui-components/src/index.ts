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

// Components
export { ThemeToggle } from './components/ThemeToggle';
export { ExportButton } from './components/ExportButton';
export { FileSelector } from './components/FileSelector';
export { ConfirmDialog } from './components/ConfirmDialog';
export { ProgressIndicator } from './components/ProgressIndicator';
export { Dialog, DialogFooter, DialogBody } from './components/Dialog';
export { InputDialog } from './components/InputDialog';
export { SkipLinks } from './components/SkipLinks';
export { KeyboardHelp } from './components/KeyboardHelp';
export { CustomSelect } from './components/CustomSelect';
export { DocumentationViewer } from './components/DocumentationViewer';
export { MarkdownRenderer } from './components/MarkdownRenderer';
export { TableOfContents } from './components/TableOfContents';
export { toSlug, extractTextContent, extractHeadings } from './utils/tocUtils';
export { isCategoryColumn, isTargetColumn } from './utils/columnMarkers';
export { FontSizeControl } from './components/FontSizeControl';
export { LoadingSpinner } from './components/LoadingSpinner';
export { ErrorBoundary } from './components/ErrorBoundary';
export { ErrorAlert } from './components/ErrorAlert';
export { ErrorPage } from './components/ErrorPage';
export { ErrorToast } from './components/ErrorToast';
export { ValidationError } from './components/ValidationError';

// Help system
export { HelpProvider, useHelp, HelpWrapper, HelpDisplay, useHelpHover } from './components/Help';
export type { HelpItem } from './components/Help';

// Dialogs
export { AboutDialog } from './dialogs/AboutDialog';

// Component Types
export type { ExportButtonProps, ExportConfig, ExportFormat } from './components/ExportButton';
export type { FileSelectorProps } from './components/FileSelector';
export type { ConfirmDialogProps } from './components/ConfirmDialog';
export type { ProgressIndicatorProps } from './components/ProgressIndicator';
export type { DialogProps } from './components/Dialog';
export type { InputDialogProps } from './components/InputDialog';
export type { SkipLinksProps, SkipLink } from './components/SkipLinks';
export type { KeyboardHelpProps } from './components/KeyboardHelp';
export type { SelectOption } from './components/CustomSelect';
export type { DocumentationViewerProps } from './components/DocumentationViewer';
export type { MarkdownRendererProps } from './components/MarkdownRenderer';
export type { TableOfContentsProps } from './components/TableOfContents';
export type { TocEntry } from './utils/tocUtils';

// Contexts
export { ThemeProvider, useTheme } from './contexts/ThemeContext';

// Hooks
export { useLoadingState, useMultipleLoadingStates } from './hooks/useLoadingState';
export { useChartTheme } from './hooks/useChartTheme';
export {
  useFocusManagement,
  useFocusRestore,
  useFocusTrap
} from './hooks/useFocusManagement';
export {
  useKeyboardShortcuts,
  useKeyboardShortcut,
  useEscapeKey,
  getModifierKey,
  formatShortcut,
  commonShortcuts,
  type KeyboardShortcut
} from './hooks/useKeyboardShortcuts';

// Utils
export {
  showError,
  handleAsync,
  getErrorMessage,
  configureErrorHandling,
  type ErrorInfo,
  type ErrorConfig
} from './utils/errorHandling';
export {
  getChartTheme,
  type ChartTheme
} from './utils/chartTheme';
export {
  ErrorTemplates,
  formatErrorMessage,
  getErrorIcon,
  getErrorColorClass,
  getErrorBgColorClass,
  parseError,
  type FormattedError,
  type ErrorSeverity
} from './utils/errorMessages';
export {
  ErrorTemplates as ErrorMessageTemplates,
  getErrorTemplate,
  formatErrorMessage as formatError,
  type ErrorTemplate
} from './utils/errorTemplates';

// Charts - Removed as part of Plotly migration
// Chart components have been replaced with Plotly visualizations below

// Plotly General Charts
export {
  PlotlyBarChart
} from './charts/PlotlyBarChart';

// PlotlyScatterChart and PlotlyLineChart were implemented and re-exported from
// charts/index.ts but never from this file, so no application could reach them.
// The regression views are their first consumer.
export { PlotlyScatterChart } from './charts/PlotlyScatterChart';
export { PlotlyLineChart } from './charts/PlotlyLineChart';
export type { ScatterChartProps, LineChartProps, ChartDataPoint } from './charts/types';

// Plotly Fullscreen Support
export { PlotlyWithFullscreen, PlotlyFullscreenModal, usePlotlyFullscreen, createFullscreenButton } from './charts/utils/plotlyFullscreen';
export { sampleLabel } from './charts/utils/sampleLabel';

// Plotly PCA Visualizations
export {
  // Components
  PCAScoresPlot,
  PCA3DScoresPlot,
  PCAScreePlot,
  PCALoadingsPlot,
  PCABiplot,
  PCA3DBiplot,
  PCACircleOfCorrelations,
  PCADiagnosticPlot,
  PCAEigencorrelationPlot,
  PCATemporalLoadingsPlot,
  PCATemporalVariableImportancePlot,
  // Classes for advanced usage
  PlotlyScoresPlot,
  Plotly3DScoresPlot,
  PlotlyScreePlot,
  PlotlyLoadingsPlot,
  PlotlyBiplot,
  Plotly3DBiplot,
  PlotlyCircleOfCorrelations,
  PlotlyDiagnosticPlot,
  PlotlyEigencorrelationPlot,
  PlotlyTemporalLoadings,
  PlotlyTemporalVariableImportance,
  // Types
  type ScoresPlotData,
  type ScoresPlotConfig,
  type Scores3DPlotData,
  type Scores3DPlotConfig,
  type ScreePlotData,
  type ScreePlotConfig,
  type LoadingsPlotData,
  type LoadingsPlotConfig,
  type BiplotData,
  type BiplotConfig,
  type Biplot3DData,
  type Biplot3DConfig,
  type CircleOfCorrelationsData,
  type CircleOfCorrelationsConfig,
  type DiagnosticPlotData,
  type DiagnosticPlotConfig,
  type EigencorrelationPlotData,
  type EigencorrelationPlotConfig,
  type TemporalLoadingsPlotData,
  type TemporalLoadingsPlotConfig,
  type TemporalVariableImportanceData,
  type TemporalVariableImportancePlotConfig
} from './charts/pca';

// Plotly Export Utils
export {
  setupPlotlyWailsIntegration
} from './charts/utils/plotlyExport';