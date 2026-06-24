import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { apiClient } from '../../api/client';
import { CellSettingsModal } from './CellSettingsModal';
import { type ThemeSettings, DEFAULT_THEME } from './DesignSettingsModal';
import styles from './DataGrid.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Column {
  id: string;
  name: string;
  width: number;
}

interface Row {
  date: string;
  rawDate: string;
  data: Record<string, CellData>;
}

interface CellData {
  text: string;
  color: string;
  staff?: string[];
  cars?: string[];
  dayType?: string;
  options?: string[];
  cellType?: string;
  projectName?: string;
}

interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

type GridItem =
  | { type: 'month-header'; monthKey: string; label: string; isCollapsed: boolean }
  | { type: 'row'; row: Row; originalIndex: number };

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// ─── Pure helpers (no closure deps, defined once) ─────────────────────────────

/** Maps legacy Google-Sheets colors to dark-theme equivalents. */
const DARK_COLOR_MAP: Record<string, string> = {
  '#b6d7a8': '#1e4620',
  '#fff2cc': '#5c4008',
  '#f4cccc': '#5c1e1e',
  '#ffe599': '#7f6000',
  '#ffd966': '#7f6000',
  '#e06666': '#660000',
  '#cc0000': '#660000',
};

const getDarkThemeColor = (color: string): string | undefined =>
  DARK_COLOR_MAP[color.toLowerCase()];

const getContrastYIQ = (hexcolor: string | undefined): string | undefined => {
  if (!hexcolor || hexcolor.startsWith('var(')) return undefined;
  let c = hexcolor.replace('#', '');
  if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
  if (c.length !== 6) return undefined;
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return ((r * 299 + g * 587 + b * 114) / 1000 >= 128) ? '#000000' : '#ffffff';
};

const hexToRgbString = (hex: string): string => {
  if (!hex) return '10, 132, 255';
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return '10, 132, 255';
  return `${parseInt(c.slice(0, 2), 16)}, ${parseInt(c.slice(2, 4), 16)}, ${parseInt(c.slice(4, 6), 16)}`;
};

const formatTodayStr = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DataGridProps {
  onDataLoaded?: (columns: Column[], rows: Row[]) => void;
  highlightText?: string;
  highlightColor?: string;
  highlightColumnId?: string;
  staffList?: string[];
  cars?: any[];
  themeSettings?: ThemeSettings;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DataGrid: React.FC<DataGridProps> = ({
  onDataLoaded,
  highlightText,
  highlightColor,
  highlightColumnId,
  staffList = [],
  cars = [],
  themeSettings = DEFAULT_THEME,
}) => {
  const [columns, setColumns] = useState<Column[]>([{ id: 'date', name: 'Дата', width: 100 }]);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<{ rowIndex: number; colIndex: number } | null>(null);
  const [shouldReload, setShouldReload] = useState(0);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});
  const [headerHovered, setHeaderHovered] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasScrolledInit, setHasScrolledInit] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);

  // Stable today strings — computed once on mount
  const todayStr = useMemo(() => formatTodayStr(new Date()), []);
  const todayMonthKey = useMemo(() => todayStr.slice(0, 7), [todayStr]);

  // The one month that should start open (current month, or last available)
  const defaultOpenMonth = useMemo(() => {
    if (rows.length === 0) return '';
    const hasCurrentMonth = rows.some(r => r.rawDate.startsWith(todayMonthKey));
    return hasCurrentMonth ? todayMonthKey : rows[rows.length - 1].rawDate.slice(0, 7);
  }, [rows, todayMonthKey]);

  // Helper: resolve whether a given month is collapsed
  const isMonthCollapsed = useCallback(
    (monthKey: string) =>
      collapsedMonths[monthKey] !== undefined
        ? collapsedMonths[monthKey]
        : monthKey !== defaultOpenMonth,
    [collapsedMonths, defaultOpenMonth],
  );

  // Per-column active-project tracking (O(columns × rows))
  const activeProjectsContext = useMemo(() => {
    const ctx: Record<string, ({ name: string; color: string } | null)[]> = {};
    for (const col of columns) {
      if (col.id === 'date') continue;
      const colCtx: ({ name: string; color: string } | null)[] = new Array(rows.length).fill(null);
      let activeProj: { name: string; color: string } | null = null;
      rows.forEach((row, i) => {
        colCtx[i] = activeProj;
        const cell = row.data[col.id] as CellData | undefined;
        if (!cell) return;
        const isProjectStart =
          cell.cellType === 'project_start' ||
          (cell.projectName && !cell.cellType) ||
          (cell.text && !activeProj && !cell.staff?.length && !cell.cars?.length &&
            cell.text !== 'Выходной' && cell.text !== 'Отсыпной' && cell.text !== 'СТОП');
        if (isProjectStart) {
          activeProj = {
            name: cell.projectName || cell.text || 'Новый проект',
            color: cell.color || 'var(--primary-color)',
          };
        } else if (cell.cellType === 'stop' || cell.dayType === 'стоп' || cell.text === 'СТОП') {
          activeProj = null;
        }
      });
      ctx[col.id] = colCtx;
    }
    return ctx;
  }, [rows, columns]);

  // Flat list of virtualizable items (month headers + rows)
  const gridItems = useMemo<GridItem[]>(() => {
    const items: GridItem[] = [];
    let currentMonth = '';
    rows.forEach((row, idx) => {
      const monthKey = row.rawDate.slice(0, 7);
      if (monthKey !== currentMonth) {
        currentMonth = monthKey;
        const collapsed = isMonthCollapsed(monthKey);
        const [y, m] = monthKey.split('-');
        items.push({
          type: 'month-header',
          monthKey,
          label: `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`,
          isCollapsed: collapsed,
        });
      }
      if (!isMonthCollapsed(monthKey)) {
        items.push({ type: 'row', row, originalIndex: idx });
      }
    });
    return items;
  }, [rows, isMonthCollapsed]);

  // Keep a ref so scrollToToday closure always sees latest items
  const gridItemsRef = useRef(gridItems);
  useEffect(() => { gridItemsRef.current = gridItems; }, [gridItems]);

  // ─── Virtualizer ─────────────────────────────────────────────────────────────

  const rowVirtualizer = useVirtualizer({
    count: gridItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  // ─── Derived layout values ────────────────────────────────────────────────────

  const totalWidth = useMemo(() => columns.reduce((acc, col) => acc + col.width, 0), [columns]);
  const dataColumns = useMemo(() => columns.slice(1), [columns]);

  // ─── Normalised selection bounds (avoids recalculation in isCellSelected) ─────

  const selectionBounds = useMemo(() => {
    if (!selection) return null;
    return {
      minRow: Math.min(selection.startRow, selection.endRow),
      maxRow: Math.max(selection.startRow, selection.endRow),
      minCol: Math.min(selection.startCol, selection.endCol),
      maxCol: Math.max(selection.startCol, selection.endCol),
    };
  }, [selection]);

  const isCellSelected = (rowIdx: number, colIdx: number): boolean => {
    if (!selectionBounds) return false;
    const { minRow, maxRow, minCol, maxCol } = selectionBounds;
    return rowIdx >= minRow && rowIdx <= maxRow && colIdx >= minCol && colIdx <= maxCol;
  };

  // ─── Data loading ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await apiClient.get('/schedule');
        const dbColumns: any[] = res.data.columns || [];
        const dbDates: any[] = res.data.dates || [];

        const newColumns: Column[] = [
          { id: 'date', name: 'Дата', width: 60 },
          ...dbColumns.map(c => ({ id: c.id, name: c.name, width: 280 })),
        ];

        const newRows: Row[] = dbDates.map((d: any) => {
          const [, , day] = d.date.split('-');
          const [, month] = d.date.split('-');
          return {
            date: `${day}.${month}`,
            rawDate: d.date,
            data: d.data,
          };
        });

        // Drop columns that have zero data across all rows
        const activeColumns = newColumns.filter(
          c => c.id === 'date' || newRows.some(r => r.data[c.id] && Object.keys(r.data[c.id]).length > 0),
        );

        setColumns(activeColumns);
        setRows(newRows);
        setError(null);
        onDataLoaded?.(activeColumns, newRows);
      } catch (err: any) {
        console.error('Failed to load schedule', err);
        setError(
          err.response?.status === 401
            ? 'Необходима авторизация. Пожалуйста, войдите в систему.'
            : 'Не удалось загрузить данные. Проверьте, запущен ли бэкенд.',
        );
      }
    };
    loadData();
  }, [onDataLoaded, shouldReload]);

  // ─── Scroll to today (on init + on date-cell click) ──────────────────────────

  const scrollToToday = useCallback(() => {
    const performScroll = () => {
      const idx = gridItemsRef.current.findIndex(
        item => item.type === 'row' && item.row.rawDate === todayStr,
      );
      if (idx !== -1) rowVirtualizer.scrollToIndex(idx, { align: 'center' });
    };

    if (isMonthCollapsed(todayMonthKey)) {
      setCollapsedMonths(prev => ({ ...prev, [todayMonthKey]: false }));
      setTimeout(performScroll, 50);
    } else {
      performScroll();
    }
  }, [todayStr, todayMonthKey, isMonthCollapsed, rowVirtualizer]);

  useEffect(() => {
    if (rows.length > 0 && !hasScrolledInit) {
      setHasScrolledInit(true);
      setTimeout(scrollToToday, 200);
    }
  }, [rows, hasScrolledInit, scrollToToday]);

  // ─── Month toggle ─────────────────────────────────────────────────────────────

  const toggleMonth = (monthKey: string) => {
    setCollapsedMonths(prev => ({ ...prev, [monthKey]: !isMonthCollapsed(monthKey) }));
  };

  // ─── Column management ────────────────────────────────────────────────────────

  const handleDeleteColumn = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот столбец? Это безвозвратно удалит все данные из него за все дни!')) return;
    await apiClient.delete(`/columns/${id}`);
    setShouldReload(p => p + 1);
  };

  const handleAddColumn = async () => {
    await apiClient.post('/columns', { name: `Колонка ${Date.now()}`, order: columns.length });
    setShouldReload(p => p + 1);
  };

  // ─── Mouse selection ──────────────────────────────────────────────────────────

  const handleMouseDown = (rowIdx: number, colIdx: number) => {
    if (colIdx === 0) return;
    setSelection({ startRow: rowIdx, startCol: colIdx, endRow: rowIdx, endCol: colIdx });
    setIsDragging(true);
  };

  const handleMouseEnter = (rowIdx: number, colIdx: number) => {
    if (!isDragging || !selection || colIdx === 0) return;
    setSelection({ ...selection, endRow: rowIdx, endCol: colIdx });
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  // ─── Keyboard: copy ───────────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selection || !(e.key === 'c' && (e.metaKey || e.ctrlKey))) return;
    e.preventDefault();
    const { minRow, maxRow, minCol, maxCol } = selectionBounds!;
    const clipboardData: any[][] = [];
    let plainText = '';
    for (let r = minRow; r <= maxRow; r++) {
      const item = gridItems[r];
      if (item.type === 'month-header') continue;
      const rowData: any[] = [];
      for (let c = minCol; c <= maxCol; c++) {
        const cell = rows[item.originalIndex].data[columns[c].id] || { text: '', color: '' };
        rowData.push(cell);
        plainText += cell.text + (c < maxCol ? '\t' : '');
      }
      clipboardData.push(rowData);
      plainText += '\n';
    }
    navigator.clipboard.write([
      new ClipboardItem({
        'text/plain': new Blob([plainText.trim()], { type: 'text/plain' }),
        'application/json': new Blob([JSON.stringify(clipboardData)], { type: 'application/json' }),
      }),
    ]);
  }, [selection, selectionBounds, rows, columns, gridItems]);

  // ─── Paste ────────────────────────────────────────────────────────────────────

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!selection) return;
    const minRow = Math.min(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const newRows = [...rows];

    let pastedJson: any[][] | null = null;
    try {
      const jsonStr = e.clipboardData?.getData('application/json');
      if (jsonStr) pastedJson = JSON.parse(jsonStr);
    } catch { /* fallback to plain text */ }

    if (pastedJson && Array.isArray(pastedJson)) {
      let pasteRowIdx = 0;
      for (let r = minRow; r < gridItems.length && pasteRowIdx < pastedJson.length; r++) {
        const item = gridItems[r];
        if (item.type === 'month-header') continue;
        for (let c = 0; c < pastedJson[pasteRowIdx].length; c++) {
          const targetCol = minCol + c;
          if (targetCol >= columns.length) break;
          const colId = columns[targetCol].id;
          newRows[item.originalIndex] = {
            ...newRows[item.originalIndex],
            data: {
              ...newRows[item.originalIndex].data,
              [colId]: { text: pastedJson[pasteRowIdx][c].text || '', color: pastedJson[pasteRowIdx][c].color || '' },
            },
          };
        }
        pasteRowIdx++;
      }
      setRows(newRows);
      setSelection({
        startRow: minRow, startCol: minCol,
        endRow: Math.min(minRow + pastedJson.length - 1, gridItems.length - 1),
        endCol: Math.min(minCol + pastedJson[0].length - 1, columns.length - 1),
      });
    } else {
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      let pasteRowIdx = 0;
      for (const line of text.split('\n')) {
        let r = minRow + pasteRowIdx;
        if (r >= gridItems.length) break;
        const item = gridItems[r];
        if (item.type === 'month-header') { pasteRowIdx++; continue; }
        line.split('\t').forEach((cell, c) => {
          const targetCol = minCol + c;
          if (targetCol >= columns.length) return;
          const colId = columns[targetCol].id;
          const existingColor = newRows[item.originalIndex].data[colId]?.color || '';
          newRows[item.originalIndex] = {
            ...newRows[item.originalIndex],
            data: { ...newRows[item.originalIndex].data, [colId]: { text: cell, color: existingColor } },
          };
        });
        pasteRowIdx++;
      }
      setRows(newRows);
    }
  }, [selection, rows, columns, gridItems]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  // ─── Cell color resolver ──────────────────────────────────────────────────────

  const resolveCellColor = (cellData: CellData, isWeekend: boolean, isStop: boolean, isWorkingShift: boolean): string | undefined => {
    if (cellData.cellType === 'project_start' || (!cellData.cellType && cellData.projectName)) {
      return cellData.color ? (getDarkThemeColor(cellData.color) ?? cellData.color) : 'var(--primary-color)';
    }
    if (isWeekend) return themeSettings.weekendColor;
    if (isStop) return themeSettings.stopColor;
    if (cellData.dayType === 'павильон') return themeSettings.pavilionColor;
    if (cellData.dayType === 'склад') return themeSettings.warehouseColor;
    if (cellData.dayType === 'переезд') return themeSettings.transferColor;
    if (isWorkingShift) return cellData.color ? (getDarkThemeColor(cellData.color) ?? cellData.color) : themeSettings.shiftColor;
    return undefined;
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className={styles.gridContainer}
      ref={parentRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{
        '--glow-rgb': hexToRgbString(themeSettings.hoverGlowColor),
        '--current-day-rgb': hexToRgbString(themeSettings.currentDayColor || '#30d158'),
      } as any}
    >
      <div
        className={styles.gridInner}
        style={{ height: `${rowVirtualizer.getTotalSize() + 40}px`, width: `${totalWidth}px` }}
      >
        {/* ── Sticky Header ─────────────────────────────────────────────────── */}
        <div
          className={styles.headerRow}
          onMouseEnter={() => setHeaderHovered(true)}
          onMouseLeave={() => setHeaderHovered(false)}
        >
          {(() => {
            const virtualItems = rowVirtualizer.getVirtualItems();
            // Skip month-header virtual rows — find the first visible *data* row
            // so the sticky project overlay never falls back to row 0 by mistake
            const topOriginalIndex = (() => {
              for (const vi of virtualItems) {
                const item = gridItems[vi.index];
                if (item?.type === 'row') return item.originalIndex;
              }
              return 0;
            })();

            return columns.map((col, index) => {
              const activeProjForHeader =
                col.id !== 'date' ? activeProjectsContext[col.id]?.[topOriginalIndex] ?? null : null;

              return (
                <div
                  key={col.id}
                  className={styles.headerCell}
                  onClick={index === 0 ? scrollToToday : undefined}
                  style={{
                    width: col.width,
                    cursor: index === 0 ? 'pointer' : 'default',
                    position: index === 0 ? 'sticky' : 'relative',
                    left: index === 0 ? 0 : undefined,
                    zIndex: index === 0 ? 21 : undefined,
                    backgroundColor: index === 0 ? 'var(--panel-bg)' : undefined,
                    borderRight: index === 0 ? '1px solid var(--border-color)' : undefined,
                  }}
                >
                  {activeProjForHeader ? (
                    // Project overlay covers the entire header cell
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--panel-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 22 }}>
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: activeProjForHeader.color, opacity: 0.15, pointerEvents: 'none' }} />
                      <span style={{ position: 'relative', fontWeight: 500, color: 'var(--text-primary)', pointerEvents: 'none' }}>{activeProjForHeader.name}</span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteColumn(col.id); }}
                        style={{ position: 'absolute', right: '8px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px', opacity: 0.5 }}
                        title="Удалить столбец"
                      >✕</button>
                    </div>
                  ) : index === 0 ? (
                    col.name
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '0 8px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Столбец {index}</span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteColumn(col.id); }}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', opacity: 0.7 }}
                        title="Удалить столбец"
                      >✕</button>
                    </div>
                  )}
                </div>
              );
            });
          })()}

          {/* Floating "Add column" button — appears on header hover */}
          <div style={{
            position: 'sticky', right: '24px', width: 0, height: '40px',
            display: 'flex', alignItems: 'center', zIndex: 30, overflow: 'visible',
            opacity: headerHovered ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: headerHovered ? 'auto' : 'none',
          }}>
            <button
              onClick={handleAddColumn}
              style={{
                width: '28px', height: '28px', borderRadius: '50%',
                backgroundColor: 'var(--primary-color)', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                transform: 'translateX(50%)',
              }}
              title="Добавить столбец"
            >+</button>
          </div>
        </div>

        {error && <div style={{ padding: '20px', color: 'var(--danger-color)' }}>{error}</div>}

        {/* ── Virtualised Rows ───────────────────────────────────────────────── */}
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const item = gridItems[virtualRow.index];
          const baseStyle = {
            top: `${virtualRow.start + 40}px`,
            height: `${virtualRow.size}px`,
            width: `${totalWidth}px`,
          };

          if (item.type === 'month-header') {
            return (
              <div
                key={virtualRow.index}
                className={styles.monthHeaderRow}
                style={baseStyle}
                onClick={() => toggleMonth(item.monthKey)}
              >
                <div className={styles.monthHeaderContent}>
                  <span className={styles.monthHeaderToggle}>{item.isCollapsed ? '▶' : '▼'}</span> {item.label}
                </div>
              </div>
            );
          }

          const row = item.row;
          const isToday = row.rawDate === todayStr;

          return (
            <div key={virtualRow.index} className={styles.row} style={{ ...baseStyle, position: 'absolute', left: 0 }}>
              {isToday && <div className={styles.currentDayOverlay} />}

              {/* Sticky date cell */}
              <div
                className={`${styles.cell} ${styles.dateCell}`}
                style={{ width: columns[0].width, cursor: 'default' }}
                onClick={scrollToToday}
              >
                {row.date}
              </div>

              {/* Data cells */}
              {dataColumns.map((col, colIndex) => {
                const actualColIndex = colIndex + 1;
                const cellData: CellData = row.data[col.id] || { text: '', color: '' };
                const selected = isCellSelected(virtualRow.index, actualColIndex);
                const activeProjectForCell = activeProjectsContext[col.id]?.[item.originalIndex] ?? null;

                const isProjectStart = cellData.cellType === 'project_start' || (!cellData.cellType && !!cellData.projectName);
                const hasLegacyText = !!cellData.text && !['Выходной', 'Отсыпной', 'СТОП'].includes(cellData.text.trim()) && cellData.text.trim().length > 0;
                const isWorkingShift = cellData.cellType === 'shift' || !!cellData.staff?.length || !!cellData.dayType || !!cellData.cars?.length || hasLegacyText;
                const isWeekend = cellData.text === 'Выходной' || cellData.dayType === 'выходной' || cellData.text === 'Отсыпной' || cellData.dayType === 'отсыпной';
                const isStop = cellData.text === 'СТОП' || cellData.dayType === 'стоп';
                const isCellInProject = !!activeProjectForCell && !isProjectStart && (isWorkingShift || isWeekend);

                const mappedColor = resolveCellColor(cellData, isWeekend, isStop, isWorkingShift);
                const textColor = selected ? undefined : getContrastYIQ(mappedColor);

                // Highlight filter
                let cellClass = styles.cell;
                if (selected) cellClass += ` ${styles.selected}`;
                if (highlightText || highlightColor || highlightColumnId) {
                  const isMatch =
                    highlightColumnId === col.id ||
                    (!!highlightText && cellData.text?.includes(highlightText)) ||
                    (!!highlightColor && cellData.color === highlightColor);
                  cellClass += isMatch ? ` ${styles.highlighted}` : ` ${styles.dimmed}`;
                }

                return (
                  <div
                    key={col.id}
                    className={cellClass}
                    style={{ width: col.width, backgroundColor: selected ? undefined : mappedColor, color: textColor, position: 'relative' }}
                    onMouseDown={() => handleMouseDown(virtualRow.index, actualColIndex)}
                    onMouseEnter={() => handleMouseEnter(virtualRow.index, actualColIndex)}
                    onClick={() => setActiveCell({ rowIndex: virtualRow.index, colIndex: actualColIndex })}
                  >
                    {selected && mappedColor && (
                      <div className={styles.selectionOverlay} style={{ backgroundColor: mappedColor }} />
                    )}
                    {isCellInProject && (
                      <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1, borderRadius: '4px',
                        boxShadow: `inset 0 0 16px ${activeProjectForCell!.color}${isWeekend ? '0D' : '1A'}`,
                      }} />
                    )}
                    <span className={styles.cellText} style={{ zIndex: 2 }}>
                      {isProjectStart ? (
                        <span style={{ fontWeight: 'bold', color: textColor }}>{cellData.projectName || cellData.text}</span>
                      ) : (
                        <>
                          {cellData.staff?.length ? cellData.staff.join(', ') : cellData.text}
                          {!!cellData.cars?.length && ' 🚗'}
                          {cellData.dayType && !['выходной', 'отсыпной', 'стоп'].includes(cellData.dayType) && ` [${cellData.dayType}]`}
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Cell Settings Modal ──────────────────────────────────────────────── */}
      {activeCell && gridItems[activeCell.rowIndex]?.type === 'row' && (() => {
        const item = gridItems[activeCell.rowIndex] as Extract<GridItem, { type: 'row' }>;
        const col = columns[activeCell.colIndex];
        return (
          <CellSettingsModal
            isOpen={true}
            onClose={() => setActiveCell(null)}
            staffList={staffList}
            cars={cars}
            date={item.row.date}
            columnName={col.name}
            initialData={item.row.data[col.id] || {}}
            activeProject={activeProjectsContext[col.id]?.[item.originalIndex] ?? null}
            onSave={async (newData) => {
              const row = item.row;
              const oldCell = (row.data[col.id] || {}) as CellData;
              const isDeletingProjectStart = (oldCell as any).cellType === 'project_start' && newData.cellType !== 'project_start';

              const fullData: Record<string, any> = { ...row.data };
              if (Object.keys(newData).length === 0) {
                delete fullData[col.id];
              } else {
                fullData[col.id] = { ...row.data[col.id], ...newData, text: newData.text || '', color: newData.color || '' };
              }

              try {
                if (isDeletingProjectStart) {
                  // Cascade-delete all cells in this column until the next STOP
                  const updates = [{ date: row.rawDate, data: fullData }];
                  const newRows = [...rows];
                  newRows[item.originalIndex] = { ...row, data: fullData };

                  for (let i = item.originalIndex + 1; i < rows.length; i++) {
                    const nextRow = rows[i];
                    const nextCell = nextRow.data[col.id] as any;
                    if (!nextCell) continue;
                    const nextData = { ...nextRow.data };
                    delete nextData[col.id];
                    updates.push({ date: nextRow.rawDate, data: nextData });
                    newRows[i] = { ...nextRow, data: nextData };
                    if (nextCell.cellType === 'stop' || nextCell.dayType === 'стоп' || nextCell.text === 'СТОП') break;
                  }

                  await Promise.all(updates.map(u => apiClient.put('/schedule', u)));
                  setRows(newRows);
                } else {
                  await apiClient.put('/schedule', { date: row.rawDate, data: fullData });
                  const newRows = [...rows];
                  newRows[item.originalIndex] = { ...row, data: fullData };
                  setRows(newRows);
                }
                setActiveCell(null);
              } catch (err) {
                console.error('Failed to save cell data', err);
                alert('Ошибка сохранения');
              }
            }}
          />
        );
      })()}
    </div>
  );
};
