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
import { main } from '../api/backend';
import { Undo, Redo, GetUndoRedoState } from '../api/backend';
import { Events, events } from '../api/backend';

interface UndoRedoControlsProps {
    className?: string;
    fileData: main.FileData | null;
    onDataUpdate?: (data: main.FileData) => void;
}

export const UndoRedoControls: React.FC<UndoRedoControlsProps> = ({ className = '', fileData, onDataUpdate }) => {
    const [undoRedoState, setUndoRedoState] = useState<main.UndoRedoState | null>(null);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        // Get initial state
        updateUndoRedoState();

        // Listen for state changes
        const unsubscribe = Events.On(events.UndoRedoStateChanged, ({ data: state }) => {
            setUndoRedoState(state);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const updateUndoRedoState = async () => {
        try {
            const state = await GetUndoRedoState();
            setUndoRedoState(state);
        } catch (error) {
            console.error('Error getting undo/redo state:', error);
        }
    };

    const handleUndo = async () => {
        if (!fileData) {
return;
}
        try {
            const updatedData = await Undo(fileData);
            if (updatedData && onDataUpdate) {
                onDataUpdate(updatedData);
            }
        } catch (error) {
            console.error('Undo error:', error);
        }
    };

    const handleRedo = async () => {
        if (!fileData) {
return;
}
        try {
            const updatedData = await Redo(fileData);
            if (updatedData && onDataUpdate) {
                onDataUpdate(updatedData);
            }
        } catch (error) {
            console.error('Redo error:', error);
        }
    };

    // Register keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
            const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

            if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                if (undoRedoState?.canUndo) {
                    handleUndo();
                }
            } else if ((isCtrlOrCmd && e.key === 'y') || (isCtrlOrCmd && e.shiftKey && e.key === 'z')) {
                e.preventDefault();
                if (undoRedoState?.canRedo) {
                    handleRedo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [undoRedoState]);

    if (!undoRedoState) {
        return null;
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <button
                onClick={handleUndo}
                disabled={!undoRedoState.canUndo}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-300 dark:border-gray-500"
                title="Undo (Ctrl+Z)"
            >
                <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                    </svg>
                    Undo
                </span>
            </button>

            <button
                onClick={handleRedo}
                disabled={!undoRedoState.canRedo}
                className="px-3 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors border border-gray-300 dark:border-gray-500"
                title="Redo (Ctrl+Y)"
            >
                <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10H11a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6" />
                    </svg>
                    Redo
                </span>
            </button>

            {/* History dropdown */}
            <div className="relative">
                <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="px-2 py-1.5 text-sm bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors border border-gray-300 dark:border-gray-500"
                    title="View history"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button>

                {showHistory && undoRedoState.history.length > 0 && (
                    <div className="absolute top-full right-0 mt-2 w-64 max-h-64 overflow-y-auto bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
                        <div className="p-2">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                                Command History
                            </div>
                            {undoRedoState.history.map((item, index) => (
                                <div
                                    key={index}
                                    className={`px-2 py-1 text-xs rounded ${
                                        index === undoRedoState.currentPos
                                            ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-medium'
                                            : index <= undoRedoState.currentPos
                                            ? 'text-gray-700 dark:text-gray-300'
                                            : 'text-gray-400 dark:text-gray-500'
                                    }`}
                                >
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};