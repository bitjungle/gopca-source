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

import React, { useCallback, useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridReadyEvent, CellValueChangedEvent, GridApi, ColumnApi, ColumnResizedEvent } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import { useTheme, isCategoryColumn } from '@gopca/ui-components';
import { ExecuteDeleteRows, ExecuteDeleteColumns, ExecuteInsertRow, ExecuteInsertColumn, ExecuteToggleTargetColumn, ExecuteToggleCategoryColumn, ExecuteAddRowNumbers, ExecuteDuplicateRows, ExecuteSetRowNames, ExecuteMoveRowNamesIntoTable, CanUseAsRowNames, ExecuteReorderColumns } from '../../wailsjs/go/main/App';
import { RenameDialog } from './RenameDialog';
import { ConfirmDialog } from '@gopca/ui-components';
import {
    TargetColumnIcon,
    CategoryColumnIcon,
    TargetColumnMenuIcon,
    CategoryColumnMenuIcon,
    RowNameMenuIcon,
    PencilIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    ArrowUpIcon,
    ArrowDownIcon,
    TrashIcon,
    DocumentDuplicateIcon
} from './ColumnIcons';

interface CSVGridProps {
    data: string[][];
    headers: string[];
    rowNames?: string[];
    rowNamesHeader?: string;
    fileData: any; // The full FileData object for operations
    onDataChange?: (rowIndex: number, colIndex: number, newValue: string) => void;
    onHeaderChange?: (colIndex: number, newHeader: string) => void;
    onRowNameChange?: (rowIndex: number, newRowName: string) => void;
    onRefresh?: (updatedData?: any) => void; // Callback to refresh data after operations
}

// Context menu component
interface ContextMenuItem {
    label?: string;
    action?: () => void;
    icon?: string | React.ReactNode;
    separator?: boolean;
    // A disabled item stays visible and carries its reason in the label, so an
    // unavailable operation explains itself instead of quietly not being there.
    disabled?: boolean;
}

interface ContextMenuProps {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, items, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[200px]"
            style={{ left: x, top: y }}
        >
            {items.map((item, index) => {
                if (item.separator) {
                    return <div key={index} className="border-t border-gray-200 dark:border-gray-700 my-1" />;
                }
                return (
                    <button
                        key={index}
                        disabled={item.disabled}
                        title={item.disabled ? item.label : undefined}
                        onClick={() => {
                            if (item.disabled) {
                                return;
                            }
                            item.action?.();
                            onClose();
                        }}
                        className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
                            item.disabled
                                ? 'opacity-50 cursor-not-allowed'
                                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                    >
                        {item.icon && (
                            typeof item.icon === 'string' ?
                                <span dangerouslySetInnerHTML={{ __html: item.icon }} /> :
                                item.icon
                        )}
                        <span>{item.label}</span>
                    </button>
                );
            })}
        </div>
    );
};

// Custom header component for AG-Grid to display icons
const CustomHeader = (props: any) => {
    const { displayName, isTargetColumn, isCategoricalColumn } = props;

    return (
        <div className="ag-header-cell-label" style={{ display: 'flex', alignItems: 'center' }}>
            <span className="ag-header-cell-text">{displayName}</span>
            {isTargetColumn && <TargetColumnIcon />}
            {isCategoricalColumn && <CategoryColumnIcon />}
        </div>
    );
};

export const CSVGrid = forwardRef<any, CSVGridProps>(({
    data,
    headers,
    rowNames,
    rowNamesHeader,
    fileData,
    onDataChange,
    onHeaderChange,
    onRowNameChange,
    onRefresh
}, ref) => {
    // All hooks must be declared before any conditional returns
    const gridRef = useRef<AgGridReact>(null);
    const [gridApi, setGridApi] = useState<GridApi | null>(null);
    const [columnApi, setColumnApi] = useState<ColumnApi | null>(null);
    const { theme } = useTheme();
    const [hasUserResized, setHasUserResized] = useState(false);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        items: ContextMenuItem[];
    } | null>(null);

    // Rename dialog state
    const [renameDialog, setRenameDialog] = useState<{
        isOpen: boolean;
        colIndex: number;
        currentName: string;
    }>({ isOpen: false, colIndex: -1, currentName: '' });

    // Confirm dialog state
    const [confirmDialog, setConfirmDialog] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    // Detect column types
    // Note: All hooks are declared before the validation check below to comply with React Hooks rules
    const detectColumnType = useCallback((colIndex: number): 'numeric' | 'text' | 'mixed' => {
        // A #category marker settles the question before the values are read.
        // The whole claim of that marker is that the numbers are labels rather
        // than quantities, so deciding from the values would contradict it --
        // and did, rendering a row identifier as "1.0000" (#945). #target is
        // deliberately not included: a target is a measurement held out of the
        // analysis, so it keeps its numeric formatting.
        if (isCategoryColumn(headers[colIndex] ?? '')) {
            return 'text';
        }

        let hasNumeric = false;
        let hasText = false;

        for (let i = 0; i < Math.min(data.length, 100); i++) { // Sample first 100 rows
            const value = data[i]?.[colIndex];
            if (value && value.trim()) {
                if (!isNaN(Number(value))) {
                    hasNumeric = true;
                } else {
                    hasText = true;
                }
            }
        }

        if (hasNumeric && !hasText) {
return 'numeric';
}
        if (hasText && !hasNumeric) {
return 'text';
}
        return 'mixed';
    }, [data, headers]);

    // Declare context menu handlers early
    const handleHeaderContextMenu = useCallback(async (event: React.MouseEvent, colIndex: number) => {
        event.preventDefault();

        const header = headers[colIndex];
        const isTargetColumn = header.toLowerCase().endsWith('#target') ||
                              header.toLowerCase().endsWith('# target');
        const isCategoryColumn = header.toLowerCase().endsWith('#category') ||
                              header.toLowerCase().endsWith('# category');

        // Whether this column can serve as row names is a property of its
        // values, so ask the backend rather than guessing here. The same check
        // is enforced in ExecuteSetRowNames; this only lets the menu explain
        // itself before the click instead of after.
        let rowNameCheck: { ok: boolean; reason?: string } = { ok: false, reason: 'no data' };
        if (fileData) {
            try {
                rowNameCheck = await CanUseAsRowNames(fileData, colIndex);
            } catch (error) {
                console.error('Error checking row-name candidacy:', error);
            }
        }
        const hasRowNames = Boolean(rowNames && rowNames.length > 0);

        const items: ContextMenuItem[] = [
            {
                label: rowNameCheck.ok
                    ? 'Use as Row Names'
                    : `Use as Row Names — ${rowNameCheck.reason}`,
                disabled: !rowNameCheck.ok,
                action: async () => {
                    if (fileData && rowNameCheck.ok) {
                        try {
                            const updatedData = await ExecuteSetRowNames(fileData, colIndex);
                            onRefresh?.(updatedData);
                        } catch (error) {
                            console.error('Error setting row names:', error);
                        }
                    }
                },
                icon: <RowNameMenuIcon />
            },
            ...(!hasRowNames
                ? [{
                    // Offered only when the file has none. The command refuses when
                    // row names already exist, so gating this on hasRowNames would
                    // hide it in exactly the situation it is for (#923).
                    label: 'Number the Rows',
                    action: async () => {
                        if (fileData) {
                            try {
                                const updatedData = await ExecuteAddRowNumbers(fileData);
                                onRefresh?.(updatedData);
                            } catch (error) {
                                console.error('Error numbering rows:', error);
                            }
                        }
                    },
                    icon: <RowNameMenuIcon />
                }]
                : []),
            ...(hasRowNames
                ? [{
                    label: 'Move Row Names into Table',
                    action: async () => {
                        if (fileData) {
                            try {
                                const updatedData = await ExecuteMoveRowNamesIntoTable(fileData);
                                onRefresh?.(updatedData);
                            } catch (error) {
                                console.error('Error moving row names into table:', error);
                            }
                        }
                    },
                    icon: <RowNameMenuIcon />
                }]
                : []),
            { separator: true },
            {
                label: isTargetColumn ? 'Remove Target Flag' : 'Mark as Target Column',
                action: async () => {
                    if (fileData) {
                        try {
                            const updatedData = await ExecuteToggleTargetColumn(fileData, colIndex);
                            onRefresh?.(updatedData);
                        } catch (error) {
                            console.error('Error toggling target column:', error);
                        }
                    }
                },
                icon: <TargetColumnMenuIcon />
            },
            {
                // For a column of numbers that are really labels -- a processing
                // code, a site number. Without this they enter the PCA as
                // measurements, where their variance is arbitrary (#914).
                label: isCategoryColumn ? 'Remove Category Flag' : 'Mark as Category Column',
                action: async () => {
                    if (fileData) {
                        try {
                            const updatedData = await ExecuteToggleCategoryColumn(fileData, colIndex);
                            onRefresh?.(updatedData);
                        } catch (error) {
                            console.error('Error toggling category column:', error);
                        }
                    }
                },
                icon: <CategoryColumnMenuIcon />
            },
            {
                label: 'Rename Column',
                action: () => {
                    setRenameDialog({
                        isOpen: true,
                        colIndex: colIndex,
                        currentName: header
                    });
                },
                icon: <PencilIcon />
            },
            {
                label: 'Insert Column Before',
                action: async () => {
                    if (fileData) {
                        const updatedData = await ExecuteInsertColumn(fileData, colIndex, '');
                        onRefresh?.(updatedData);
                    }
                },
                icon: <ArrowLeftIcon />
            },
            {
                label: 'Insert Column After',
                action: async () => {
                    if (fileData) {
                        const updatedData = await ExecuteInsertColumn(fileData, colIndex + 1, '');
                        onRefresh?.(updatedData);
                    }
                },
                icon: <ArrowRightIcon />
            },
            { separator: true },
            {
                label: 'Delete Column',
                action: () => {
                    if (fileData) {
                        setConfirmDialog({
                            isOpen: true,
                            title: 'Delete Column',
                            message: `Are you sure you want to delete column '${header}'?`,
                            onConfirm: async () => {
                                try {
                                    const updatedData = await ExecuteDeleteColumns(fileData, [colIndex]);
                                    onRefresh?.(updatedData);
                                } catch (error) {
                                    console.error('Error deleting column:', error);
                                }
                            }
                        });
                    }
                },
                icon: <TrashIcon />
            }
        ];

        setContextMenu({ x: event.clientX, y: event.clientY, items });
    }, [fileData, headers, rowNames, onRefresh]);

    const handleRowContextMenu = useCallback((event: React.MouseEvent, rowIndex: number) => {
        event.preventDefault();

        const items: ContextMenuItem[] = [
            {
                label: 'Insert Row Above',
                action: async () => {
                    if (fileData) {
                        const updatedData = await ExecuteInsertRow(fileData, rowIndex);
                        onRefresh?.(updatedData);
                    }
                },
                icon: <ArrowUpIcon />
            },
            {
                label: 'Insert Row Below',
                action: async () => {
                    if (fileData) {
                        const updatedData = await ExecuteInsertRow(fileData, rowIndex + 1);
                        onRefresh?.(updatedData);
                    }
                },
                icon: <ArrowDownIcon />
            },
            { separator: true },
            {
                label: 'Duplicate Row',
                action: async () => {
                    if (fileData) {
                        const selectedRows = gridApi?.getSelectedRows() || [];
                        const rowIndices = selectedRows.length > 0
                            ? selectedRows.map(row => row.id)
                            : [rowIndex];

                        const updatedData = await ExecuteDuplicateRows(fileData, rowIndices);
                        onRefresh?.(updatedData);
                    }
                },
                icon: <DocumentDuplicateIcon />
            },
            {
                label: 'Delete Row',
                action: () => {
                    if (fileData) {
                        const selectedRows = gridApi?.getSelectedRows() || [];
                        const rowIndices = selectedRows.length > 0
                            ? selectedRows.map(row => row.id)
                            : [rowIndex];

                        const confirmMsg = rowIndices.length > 1
                            ? `Are you sure you want to delete ${rowIndices.length} rows?`
                            : 'Are you sure you want to delete this row?';

                        setConfirmDialog({
                            isOpen: true,
                            title: 'Delete Row',
                            message: confirmMsg,
                            onConfirm: async () => {
                                try {
                                    const updatedData = await ExecuteDeleteRows(fileData, rowIndices);
                                    onRefresh?.(updatedData);
                                } catch (error) {
                                    console.error('Error deleting rows:', error);
                                }
                            }
                        });
                    }
                },
                icon: <TrashIcon />
            }
        ];

        setContextMenu({ x: event.clientX, y: event.clientY, items });
    }, [fileData, gridApi, onRefresh]);

    // Create column definitions
    const columnDefs = useMemo<ColDef[]>(() => {
        const cols: ColDef[] = [];

        // Position gutter. Always present, whether or not the file has row names.
        //
        // Without it a file with no row names has no row identity of any kind,
        // so every row number the Data Quality Report prints -- "row 41", the
        // rows behind an outlier count -- names something the user cannot find
        // (#931). Numbered from 1 to match those messages.
        //
        // This is not `Number the Rows`, which writes real row names into the
        // data as the identifier of last resort. This is display furniture: it
        // is not editable, it is not part of `data`, and so it is never
        // exported or analysed. The muted styling keeps the two distinguishable
        // at a glance.
        cols.push({
            field: 'position',
            headerName: '#',
            // The row's position in the data, not on screen. node.rowIndex would
            // renumber when a column is sorted, and the report's row numbers
            // refer to the file, so the two would silently stop agreeing.
            valueGetter: (params) => (params.data?.id ?? 0) + 1,
            editable: false,
            sortable: false,
            filter: false,
            resizable: false,
            suppressMovable: true,
            width: 64,
            minWidth: 48,
            cellClass: 'position-cell',
            headerClass: 'position-header',
            pinned: 'left',
            lockPinned: true,
            cellStyle: {
                color: theme === 'dark' ? '#9ca3af' : '#6b7280',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums'
            }
        });

        // Add row name column if present
        if (rowNames && rowNames.length > 0) {
            cols.push({
                field: 'rowName',
                // The row-name column's own header, now that it survives the
                // load (#859). Blank remains correct for the many files that
                // leave it empty by convention.
                headerName: rowNamesHeader || '',
                editable: true,
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 100,
                maxWidth: 300,
                cellClass: 'row-name-cell',
                headerClass: 'row-name-header',
                pinned: 'left',
                lockPinned: true,
                cellStyle: {
                    backgroundColor: theme === 'dark' ? '#374151' : '#f3f4f6',
                    fontWeight: 'bold'
                }
            });
        }

        // Add data columns
        headers.forEach((header, index) => {
            const colType = detectColumnType(index);
            const isTargetColumn = header.toLowerCase().endsWith('#target') ||
                                 header.toLowerCase().endsWith('# target');

            // Check if column is categorical (if fileData has categoricalColumns info)
            const isCategoricalColumn = fileData?.categoricalColumns &&
                                      Object.keys(fileData.categoricalColumns).includes(header);

            cols.push({
                field: `col${index}`,
                headerName: header,
                headerComponent: CustomHeader,
                headerComponentParams: {
                    displayName: header,
                    isTargetColumn,
                    isCategoricalColumn,
                    colIndex: index,
                    onContextMenu: handleHeaderContextMenu
                },
                editable: true,
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 80,
                maxWidth: 400,
                cellClass: (params) => {
                    const classes = [];
                    if (colType === 'numeric') {
classes.push('numeric-cell');
}
                    if (colType === 'mixed') {
classes.push('mixed-cell');
}
                    if (isTargetColumn) {
classes.push('target-column');
}

                    // Check for missing values using same logic as backend
                    const value = params.value?.toString().trim() || '';
                    const lowerValue = value.toLowerCase();
                    const isMissing = !value ||
                        ['na', 'n/a', 'nan', 'null', 'none', 'missing', '-', '?'].includes(lowerValue);

                    if (isMissing) {
classes.push('missing-value');
}
                    return classes.join(' ');
                },
                headerClass: () => {
                    const classes = [];
                    if (colType === 'numeric') {
classes.push('numeric-header');
}
                    if (colType === 'mixed') {
classes.push('mixed-header');
}
                    if (isTargetColumn) {
classes.push('target-header');
}
                    return classes.join(' ');
                },
                headerTooltip: isTargetColumn ? 'Target column - excluded from PCA (right-click to toggle)' :
                              isCategoricalColumn ? 'Categorical/grouping column' :
                              colType === 'numeric' ? 'Numeric column' :
                              colType === 'mixed' ? 'Mixed column' : 'Text column',
                valueFormatter: (params: any) => {
                    if (colType === 'numeric' && params.value) {
                        const num = Number(params.value);
                        if (!isNaN(num)) {
                            return num.toFixed(4);
                        }
                    }
                    return params.value;
                }
            });
        });

        return cols;
    }, [headers, detectColumnType, rowNames, rowNamesHeader, theme, handleHeaderContextMenu]);

    // Convert data to row format for ag-Grid
    const rowData = useMemo(() => {
        return data.map((row, rowIndex) => {
            const rowObj: any = { id: rowIndex };

            // Add row name if present
            if (rowNames && rowIndex < rowNames.length) {
                rowObj.rowName = rowNames[rowIndex];
            }

            // Add data columns
            headers.forEach((_, colIndex) => {
                rowObj[`col${colIndex}`] = row[colIndex] || '';
            });
            return rowObj;
        });
    }, [data, headers, rowNames]);

    // Grid ready event
    // Persist a column drag to the data.
    //
    // Column order is a property of the data, not the view: it decides the order
    // of an export, the order GoPCA receives, and the order a loadings plot
    // lists variables in. AG Grid columns are movable by default, so before this
    // a drag moved the column on screen and was discarded at the next render
    // (#878).
    //
    // Driven from dragStopped rather than columnMoved, which fires repeatedly
    // during the drag and would send a command per pixel.
    //
    // The grid is the source of the *intent* and the data is the source of
    // truth. Once the data is reordered, columnDefs are rebuilt in the new
    // order and AG Grid adopts them, so the two agree without the grid's own
    // move being applied a second time.
    const onDragStopped = useCallback(async () => {
        if (!gridApi || !fileData || !onRefresh) {
            return;
        }

        // The row-name column is pinned and locked, so it never takes part.
        //
        // Read through gridApi rather than columnApi: AG Grid 31 moved these
        // onto the grid API and warns on the old path. The surrounding code
        // still uses columnApi in places, but new code need not add to that.
        const displayed = gridApi
            .getAllDisplayedColumns()
            .map((column) => column.getColId())
            .filter((colId) => colId !== 'rowName');

        const order = displayed
            .map((colId) => parseInt(colId.replace('col', ''), 10))
            .filter((index) => !Number.isNaN(index));

        // Nothing to do unless this is a full permutation in a new order. A
        // partial list would mean columns are hidden or the grid is mid-update,
        // and reordering from it would drop the ones missing.
        if (order.length !== headers.length) {
            return;
        }
        if (order.every((from, to) => from === to)) {
            return;
        }

        try {
            const updated = await ExecuteReorderColumns(fileData, order);
            onRefresh(updated);
        } catch (error) {
            console.error('Error reordering columns:', error);
        }
    }, [gridApi, fileData, onRefresh, headers.length]);

    const onGridReady = useCallback((params: GridReadyEvent) => {
        setGridApi(params.api);
        setColumnApi(params.columnApi);

        // Auto-size columns based on content with a small delay to ensure data is loaded
        setTimeout(() => {
            params.columnApi.autoSizeAllColumns(false);
        }, 100);
    }, []);

    // Handle cell right-click
    const onCellContextMenu = useCallback((event: any) => {
        handleRowContextMenu(event.event, event.rowIndex);
    }, [handleRowContextMenu]);

    // Cell value changed event
    const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
        if (event.colDef?.field) {
            const rowIndex = event.node.data.id;

            if (event.colDef.field === 'rowName' && onRowNameChange) {
                onRowNameChange(rowIndex, event.newValue);
            } else if (onDataChange) {
                const colIndex = parseInt(event.colDef.field.replace('col', ''));
                onDataChange(rowIndex, colIndex, event.newValue);
            }
        }
    }, [onDataChange, onRowNameChange]);

    // Default column definition
    const defaultColDef = useMemo<ColDef>(() => ({
        minWidth: 80,
        maxWidth: 400,
        editable: true,
        sortable: true,
        filter: true,
        resizable: true
    }), []);

    // Handle keyboard shortcuts
    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!gridApi || !fileData) {
return;
}

        // Check if we're editing a cell
        const editingCells = gridApi.getEditingCells();
        if (editingCells && editingCells.length > 0) {
return;
}

        // Delete key - delete selected rows
        if (event.key === 'Delete' || event.key === 'Backspace') {
            const selectedRows = gridApi.getSelectedRows();
            if (selectedRows.length > 0) {
                event.preventDefault();
                const rowIndices = selectedRows.map(row => row.id);
                const confirmMsg = rowIndices.length > 1
                    ? `Are you sure you want to delete ${rowIndices.length} rows?`
                    : 'Are you sure you want to delete this row?';

                setConfirmDialog({
                    isOpen: true,
                    title: 'Delete Row',
                    message: confirmMsg,
                    onConfirm: async () => {
                        try {
                            const updatedData = await ExecuteDeleteRows(fileData, rowIndices);
                            onRefresh?.(updatedData);
                        } catch (error) {
                            console.error('Error deleting rows:', error);
                        }
                    }
                });
            }
        }

        // Ctrl/Cmd+D - duplicate selected rows
        if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
            event.preventDefault();
            const selectedRows = gridApi.getSelectedRows();
            if (selectedRows.length > 0) {
                const rowIndices = selectedRows.map(row => row.id);
                ExecuteDuplicateRows(fileData, rowIndices).then((updatedData) => {
                    onRefresh?.(updatedData);
                });
            }
        }
    }, [gridApi, fileData, onRefresh, setConfirmDialog]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleKeyDown]);

    // Grid options for performance
    const gridOptions = useMemo(() => ({
        // Performance optimizations
        animateRows: false,
        suppressColumnVirtualisation: false, // Enable column virtualization
        suppressRowVirtualisation: false, // Enable row virtualization (default)
        rowBuffer: 20, // Render 20 rows outside visible area
        debounceVerticalScrollbar: true, // Smoother scrolling

        // Editing
        singleClickEdit: true,
        stopEditingWhenCellsLoseFocus: true,

        // Selection
        rowSelection: 'multiple' as const,
        rowMultiSelectWithClick: true,

        // Suppress default context menu
        suppressContextMenu: true,

        // Pagination for very large datasets
        pagination: data.length > 10000,
        paginationPageSize: 1000,
        paginationPageSizeSelector: [100, 500, 1000, 5000],

        // Other options
        enableCellTextSelection: true,
        ensureDomOrder: true
    }), [data.length]);

    // Auto-size columns on window resize only if user hasn't manually resized
    useEffect(() => {
        const handleResize = () => {
            if (gridApi && columnApi && !hasUserResized) {
                // Maintain content-based sizing on window resize
                columnApi.autoSizeAllColumns(false);
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [gridApi, columnApi, hasUserResized]);

    // Expose auto-size function for external use
    useImperativeHandle(ref, () => ({
        autoSizeColumns: () => {
            if (columnApi) {
                columnApi.autoSizeAllColumns(false);
                setHasUserResized(false);
            }
        },
        // focusRows scrolls to and selects the rows a quality finding names, so
        // a finding stops being a sentence and becomes a way to reach the data
        // it describes (#931).
        //
        // `rows` are numbered from 1, matching QualityIssue.Rows and the
        // position gutter; ag-grid indexes from 0, and that single subtraction
        // is the only place the two meet.
        focusRows: (rows: number[]) => {
            if (!gridApi || !rows || rows.length === 0) {
                return;
            }
            const wanted = new Set(rows.map(row => row - 1));
            gridApi.deselectAll();

            // Two different indices are in play and mixing them scrolls to the
            // wrong place while selecting the right rows, which looks like a
            // working feature. node.data.id is the row's position in the file,
            // which is what the report's numbers mean and what the gutter
            // shows. node.rowIndex is its position on screen, which is what
            // ensureIndexVisible expects, and the two diverge as soon as a
            // column is sorted or a filter is applied.
            let firstOnScreen: number | null = null;
            gridApi.forEachNode(node => {
                if (!wanted.has(node.data?.id)) {
                    return;
                }
                node.setSelected(true);
                if (node.rowIndex !== null && node.rowIndex !== undefined &&
                    (firstOnScreen === null || node.rowIndex < firstOnScreen)) {
                    firstOnScreen = node.rowIndex;
                }
            });

            // The topmost selected row as displayed, so a finding covering many
            // rows starts at the top of the run rather than wherever ag-grid
            // happens to be. Null when none of them is currently rendered.
            if (firstOnScreen !== null) {
                gridApi.ensureIndexVisible(firstOnScreen, 'middle');
            }
        }
    }), [columnApi, gridApi]);

    // Add header right-click handling after grid is ready
    useEffect(() => {
        if (!gridApi || !columnApi) {
return;
}

        // Add event listener to ag-grid header
        const headerContainer = document.querySelector('.ag-header-container');
        if (!headerContainer) {
return;
}

        const handleHeaderRightClick = (e: Event) => {
            const event = e as MouseEvent;
            event.preventDefault();

            // Find which column was clicked
            const target = event.target as HTMLElement;
            const headerCell = target.closest('.ag-header-cell');
            if (!headerCell) {
return;
}

            const colId = headerCell.getAttribute('col-id');
            if (colId && colId.startsWith('col')) {
                const colIndex = parseInt(colId.replace('col', ''));
                handleHeaderContextMenu(event as any as React.MouseEvent, colIndex);
            }
        };

        headerContainer.addEventListener('contextmenu', handleHeaderRightClick);

        return () => {
            headerContainer.removeEventListener('contextmenu', handleHeaderRightClick);
        };
    }, [gridApi, columnApi, handleHeaderContextMenu]);

    // Early return for invalid data (placed after all hooks to satisfy React rules)
    if (!data || !headers || data.length === 0 || headers.length === 0) {
        return <div className="w-full h-full flex items-center justify-center text-gray-500">No data to display</div>;
    }

    return (
        <div className="w-full h-full">
            <div
                className={`${theme === 'dark' ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'} w-full h-full`}
                style={{
                    '--ag-header-background-color': theme === 'dark' ? '#374151' : '#f3f4f6',
                    '--ag-header-foreground-color': theme === 'dark' ? '#e5e7eb' : '#111827',
                    '--ag-background-color': theme === 'dark' ? '#1f2937' : '#ffffff',
                    '--ag-foreground-color': theme === 'dark' ? '#e5e7eb' : '#111827',
                    '--ag-row-hover-color': theme === 'dark' ? '#374151' : '#f3f4f6',
                    '--ag-selected-row-background-color': theme === 'dark' ? '#4338ca' : '#6366f1',
                    '--ag-border-color': theme === 'dark' ? '#4b5563' : '#e5e7eb'
                } as React.CSSProperties}
            >
                <style>{`
                    .numeric-header {
                        background-color: ${theme === 'dark' ? '#065f46' : '#d1fae5'} !important;
                    }
                    .mixed-header {
                        background-color: ${theme === 'dark' ? '#7c2d12' : '#fed7aa'} !important;
                    }
                    .target-header {
                        background-color: ${theme === 'dark' ? '#1e3a8a' : '#dbeafe'} !important;
                    }
                    .numeric-cell {
                        text-align: right;
                        font-family: monospace;
                    }
                    .missing-value {
                        background-color: ${theme === 'dark' ? '#7f1d1d' : '#fee2e2'} !important;
                        opacity: 0.7;
                    }
                    .target-column {
                        background-color: ${theme === 'dark' ? '#1e293b' : '#f1f5f9'} !important;
                    }
                `}</style>

                <AgGridReact
                    ref={gridRef}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    onGridReady={onGridReady}
                    onCellValueChanged={onCellValueChanged}
                    onDragStopped={onDragStopped}
                    onCellContextMenu={onCellContextMenu}
                    onColumnResized={(event: ColumnResizedEvent) => {
                        if (event.finished) {
                            setHasUserResized(true);
                        }
                    }}
                    {...gridOptions}
                />
            </div>

            {/* Custom context menu */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    items={contextMenu.items}
                    onClose={() => setContextMenu(null)}
                />
            )}

            {/* Rename dialog */}
            <RenameDialog
                isOpen={renameDialog.isOpen}
                onClose={() => setRenameDialog({ isOpen: false, colIndex: -1, currentName: '' })}
                onRename={async (newName) => {
                    if (fileData && onHeaderChange) {
                        try {
                            await onHeaderChange(renameDialog.colIndex, newName);
                        } catch (error) {
                            console.error('Error renaming column:', error);
                        }
                    }
                }}
                currentName={renameDialog.currentName}
                title="Rename Column"
            />

            {/* Confirm dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText="Delete"
                destructive={true}
            />
        </div>
    );
});

CSVGrid.displayName = 'CSVGrid';