// Test double for src/api/backend.ts: every bound method the components call,
// the model namespaces they type against, and the runtime surface. Aliased in
// vite.config.ts for the vitest environment, where no Wails bridge exists.
import { vi } from 'vitest';

export const GetVersion = vi.fn().mockResolvedValue('test-version');
export const GetGUIConfig = vi.fn().mockResolvedValue(null);
export const SaveFile = vi.fn().mockResolvedValue(undefined);
export const CheckGoCSVStatus = vi.fn().mockResolvedValue({ installed: false });
export const LoadCSVFile = vi.fn().mockResolvedValue(null);
export const LoadDatasetFile = vi.fn().mockResolvedValue(null);
export const SelectCSVFile = vi.fn().mockResolvedValue(null);
export const ReloadCSVFile = vi.fn().mockResolvedValue(null);
export const RunPCA = vi.fn().mockResolvedValue({ success: false, error: 'mock' });
export const RunPCR = vi.fn().mockResolvedValue(null);
export const ExportPCAModel = vi.fn().mockResolvedValue(undefined);
export const OpenInGoCSV = vi.fn().mockResolvedValue(undefined);
export const LaunchGoCSV = vi.fn().mockResolvedValue(undefined);
export const DownloadGoCSV = vi.fn().mockResolvedValue(undefined);
export const CalculateModelMetrics = vi.fn().mockResolvedValue({});
export const CalculateEllipses = vi.fn().mockResolvedValue(null);
export const PreprocessPreview = vi.fn().mockResolvedValue(null);
export const AnalyzeVariableAxis = vi.fn().mockResolvedValue(null);
export const OpenTutorial = vi.fn().mockResolvedValue(undefined);
export const GetAppMode = vi.fn().mockResolvedValue({ mode: 'main', dataset: '' });

class ExportPCAModelRequest {
    constructor(source: Record<string, unknown> = {}) {
        Object.assign(this, source);
    }
}
export const main = { ExportPCAModelRequest };
export const config = {};
export const types = {};
export const events = { LoadFileOnStartup: 'load-file-on-startup' };

export const Events = {
    On: vi.fn().mockReturnValue(() => {}), // returns the unsubscribe function
    Off: vi.fn(),
    Emit: vi.fn().mockResolvedValue(false)
};
export const Browser = { OpenURL: vi.fn().mockResolvedValue(undefined) };
export function required<T>(value: T | null | undefined): T { return value as T; }
export function fromWire<T>(value: unknown): T { return value as T; }
export const isWailsEnvironment = () => false;
