import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { apiClient } from '../../api/client';
import { CellSettingsModal } from './CellSettingsModal';
import { ColumnSettingsModal } from './ColumnSettingsModal';
import { type ThemeSettings, DEFAULT_THEME } from './DesignSettingsModal';
import styles from './DataGrid.module.css';

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
}

interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

const MONTH_NAMES = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

type GridItem = 
  | { type: 'month-header'; monthKey: string; label: string; isCollapsed: boolean }
  | { type: 'row'; row: Row; originalIndex: number };

export interface DataGridProps {
  onDataLoaded?: (columns: Column[], rows: Row[]) => void;
  highlightText?: string;
  highlightColor?: string;
  highlightColumnId?: string;
  staffList?: string[];
  cars?: any[];
  themeSettings?: ThemeSettings;
}

const getDarkThemeColor = (color: string) => {
  const lower = color.toLowerCase();
  if (lower === '#b6d7a8') return '#1e4620'; // Deep Green
  if (lower === '#fff2cc') return '#5c4008'; // Deep Yellow
  if (lower === '#f4cccc') return '#5c1e1e'; // Deep Red
  if (lower === '#ffe599' || lower === '#ffd966') return '#7f6000'; // Желтый (павильон)
  if (lower === '#e06666' || lower === '#cc0000') return '#660000'; // Красный (стоп)
  return undefined;
};

const getContrastYIQ = (hexcolor: string) => {
  if (!hexcolor) return undefined;
  hexcolor = hexcolor.replace('#', '');
  if (hexcolor.length === 3) {
    hexcolor = hexcolor.split('').map(c => c + c).join('');
  }
  if (hexcolor.length !== 6) return undefined;
  const r = parseInt(hexcolor.substr(0,2),16);
  const g = parseInt(hexcolor.substr(2,2),16);
  const b = parseInt(hexcolor.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
};

const hexToRgbString = (hex: string) => {
  if (!hex) return '10, 132, 255';
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  if (c.length !== 6) return '10, 132, 255';
  return `${parseInt(c.substr(0,2),16)}, ${parseInt(c.substr(2,2),16)}, ${parseInt(c.substr(4,2),16)}`;
};

export const DataGrid: React.FC<DataGridProps> = ({  
  onDataLoaded, 
  highlightText, 
  highlightColor, 
  highlightColumnId,
  staffList = [],
  cars = [],
  themeSettings = DEFAULT_THEME
}) => {
  const [columns, setColumns] = useState<Column[]>([
    { id: 'date', name: 'Дата', width: 100 }
  ]);

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [activeCell, setActiveCell] = useState<{rowIndex: number, colIndex: number} | null>(null);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [shouldReload, setShouldReload] = useState(0);
  const [collapsedMonths, setCollapsedMonths] = useState<Record<string, boolean>>({});

  const todayStrForCalc = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const activeProjectsContext = React.useMemo(() => {
    const context: Record<string, ({ name: string, color: string } | null)[]> = {};
    columns.forEach(c => {
      if (c.id === 'date') return;
      context[c.id] = new Array(rows.length).fill(null);
      let activeProj: { name: string, color: string } | null = null;
      rows.forEach((row, i) => {
        context[c.id][i] = activeProj;
        const cell = row.data[c.id];
        if (cell) {
          if (cell.cellType === 'project_start' || (cell.projectName && !cell.cellType) || (cell.text && !activeProj && !cell.staff?.length && !cell.cars?.length && cell.text !== 'Выходной' && cell.text !== 'Отсыпной' && cell.text !== 'СТОП')) {
             activeProj = { name: cell.projectName || cell.text || 'Новый проект', color: cell.color || 'var(--primary-color)' };
          } else if (cell.cellType === 'stop' || cell.dayType === 'стоп' || cell.text === 'СТОП') {
             activeProj = null;
          }
        }
      });
    });
    return context;
  }, [rows, columns]);

  const gridItems = React.useMemo(() => {
    const items: GridItem[] = [];
    let currentMonth = '';

    rows.forEach((row, idx) => {
      const monthKey = row.rawDate.substring(0, 7);
      if (monthKey !== currentMonth) {
         currentMonth = monthKey;
         const isPast = monthKey < todayStrForCalc;
         const isCollapsed = collapsedMonths[monthKey] !== undefined ? collapsedMonths[monthKey] : isPast;
         
         const [y, m] = monthKey.split('-');
         const label = `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
         items.push({ type: 'month-header', monthKey, label, isCollapsed });
      }
      
      const isCollapsed = collapsedMonths[monthKey] !== undefined ? collapsedMonths[monthKey] : (monthKey < todayStrForCalc);
      if (!isCollapsed) {
         items.push({ type: 'row', row, originalIndex: idx });
      }
    });
    return items;
  }, [rows, collapsedMonths, todayStrForCalc]);

  const toggleMonth = (monthKey: string) => {
    setCollapsedMonths(prev => {
      const isPast = monthKey < todayStrForCalc;
      const currentlyCollapsed = prev[monthKey] !== undefined ? prev[monthKey] : isPast;
      return { ...prev, [monthKey]: !currentlyCollapsed };
    });
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await apiClient.get('/schedule');
        const dbColumns = res.data.columns || [];
        const dbDates = res.data.dates || [];

        const newColumns = [
          { id: 'date', name: 'Дата', width: 60 },
          ...dbColumns.map((c: any) => ({
            id: c.id,
            name: c.name,
            width: 280
          }))
        ];

        // Format date from YYYY-MM-DD to DD.MM
        const newRows = dbDates.map((d: any) => {
          const parts = d.date.split('-');
          const displayDate = parts.length === 3 ? `${parts[2]}.${parts[1]}` : d.date;
          return {
            date: displayDate,
            rawDate: d.date,
            data: d.data
          };
        });

        // Auto-cleanup: remove completely empty columns
        const activeColumns = newColumns.filter(c => {
           if (c.id === 'date') return true;
           return newRows.some((r: any) => r.data[c.id] && Object.keys(r.data[c.id]).length > 0);
        });

        setColumns(activeColumns);
        setRows(newRows);
        setError(null);
        if (onDataLoaded) {
          onDataLoaded(activeColumns, newRows);
        }
      } catch (err: any) {
        console.error('Failed to load schedule', err);
        if (err.response?.status === 401) {
          setError('Необходима авторизация. Пожалуйста, войдите в систему.');
        } else {
          setError('Не удалось загрузить данные. Проверьте, запущен ли бэкенд.');
        }
      }
    };
    loadData();
  }, [onDataLoaded, shouldReload]);

  const parentRef = useRef<HTMLDivElement>(null);
  
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: gridItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const handleMouseDown = (rowIdx: number, colIdx: number) => {
    // Only allow selecting data columns, not the date column (index 0)
    if (colIdx === 0) return;
    setSelection({
      startRow: rowIdx,
      startCol: colIdx,
      endRow: rowIdx,
      endCol: colIdx,
    });
    setIsDragging(true);
  };

  const handleMouseEnter = (rowIdx: number, colIdx: number) => {
    if (isDragging && selection && colIdx !== 0) {
      setSelection({
        ...selection,
        endRow: rowIdx,
        endCol: colIdx,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  const isCellSelected = (rowIdx: number, colIdx: number) => {
    if (!selection) return false;
    const minRow = Math.min(selection.startRow, selection.endRow);
    const maxRow = Math.max(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);
    const maxCol = Math.max(selection.startCol, selection.endCol);
    return rowIdx >= minRow && rowIdx <= maxRow && colIdx >= minCol && colIdx <= maxCol;
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selection) return;

    if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      // Copy
      const minRow = Math.min(selection.startRow, selection.endRow);
      const maxRow = Math.max(selection.startRow, selection.endRow);
      const minCol = Math.min(selection.startCol, selection.endCol);
      const maxCol = Math.max(selection.startCol, selection.endCol);

      const clipboardData: any[][] = [];
      let plainText = '';

      for (let r = minRow; r <= maxRow; r++) {
        const item = gridItems[r];
        if (item.type === 'month-header') continue;
        const originalIndex = item.originalIndex;
        const rowData = [];
        for (let c = minCol; c <= maxCol; c++) {
          const colId = columns[c].id;
          const cell = rows[originalIndex].data[colId] || { text: '', color: '' };
          rowData.push(cell);
          plainText += cell.text + (c < maxCol ? '\t' : '');
        }
        clipboardData.push(rowData);
        plainText += '\n';
      }

      navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plainText.trim()], { type: 'text/plain' }),
          'application/json': new Blob([JSON.stringify(clipboardData)], { type: 'application/json' })
        })
      ]);
    }
  }, [selection, rows, columns]);

  const handlePaste = useCallback(async (e: ClipboardEvent) => {
    if (!selection) return;
    
    let pastedJson;
    try {
      const jsonStr = e.clipboardData?.getData('application/json');
      if (jsonStr) {
        pastedJson = JSON.parse(jsonStr);
      }
    } catch {
      // Fallback
    }

    const minRow = Math.min(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);

    const newRows = [...rows];

    if (pastedJson && Array.isArray(pastedJson)) {
      let pastedRowIdx = 0;
      for (let r = minRow; r < gridItems.length && pastedRowIdx < pastedJson.length; r++) {
        const item = gridItems[r];
        if (item.type === 'month-header') continue;
        const targetRow = item.originalIndex;

        for (let c = 0; c < pastedJson[pastedRowIdx].length; c++) {
          const targetCol = minCol + c;
          if (targetCol >= columns.length) break;

          const colId = columns[targetCol].id;
          newRows[targetRow] = {
            ...newRows[targetRow],
            data: {
              ...newRows[targetRow].data,
              [colId]: {
                text: pastedJson[pastedRowIdx][c].text || '',
                color: pastedJson[pastedRowIdx][c].color || ''
              }
            }
          };
        }
        pastedRowIdx++;
      }
      setRows(newRows);
      
      // Select the newly pasted area
      setSelection({
        startRow: minRow,
        startCol: minCol,
        endRow: Math.min(minRow + pastedJson.length - 1, gridItems.length - 1),
        endCol: Math.min(minCol + pastedJson[0].length - 1, columns.length - 1)
      });
    } else {
      // Plain text paste fallback
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      
      const textRows = text.split('\n');
      let pastedRowIdx = 0;
      for (let r = minRow; r < gridItems.length && pastedRowIdx < textRows.length; r++) {
        const item = gridItems[r];
        if (item.type === 'month-header') continue;
        const targetRow = item.originalIndex;

        const cells = textRows[pastedRowIdx].split('\t');
        pastedRowIdx++;
        
        for (let c = 0; c < cells.length; c++) {
          const targetCol = minCol + c;
          if (targetCol >= columns.length) break;

          const colId = columns[targetCol].id;
          // Keep existing color, just change text
          const existingColor = newRows[targetRow].data[colId]?.color || '';
          newRows[targetRow] = {
            ...newRows[targetRow],
            data: {
              ...newRows[targetRow].data,
              [colId]: {
                text: cells[c] || '',
                color: existingColor
              }
            }
          };
        }
      }
      setRows(newRows);
    }
  }, [selection, rows, columns, gridItems]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const totalWidth = columns.reduce((acc, col) => acc + col.width, 0);
  const dataColumns = columns.slice(1);

  const handleSaveColumns = async (newCols: Column[], deletedIds: string[], addedCols: {name: string, order: number}[]) => {
    for (const id of deletedIds) {
      await apiClient.delete(`/columns/${id}`);
    }
    const idMap: Record<string, string> = {};
    for (const c of addedCols) {
      const res = await apiClient.post('/columns', { name: c.name, order: c.order });
      idMap[c.name] = res.data.id;
    }
    const updates = newCols.map((c, i) => ({
      id: c.id.startsWith('new-') ? idMap[c.name] : c.id,
      order: i
    }));
    await apiClient.put('/columns/reorder', updates);
    setShouldReload(prev => prev + 1);
  };

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const gridItemsRef = useRef(gridItems);
  useEffect(() => {
    gridItemsRef.current = gridItems;
  }, [gridItems]);

  const scrollToToday = () => {
    const todayMonthKey = todayStr.substring(0, 7);
    
    const performScroll = () => {
      const latestItems = gridItemsRef.current;
      const todayIndex = latestItems.findIndex(item => item.type === 'row' && item.row.rawDate === todayStr);
      if (todayIndex !== -1) {
        rowVirtualizer.scrollToIndex(todayIndex, { align: 'center' });
      }
    };

    if (collapsedMonths[todayMonthKey]) {
      setCollapsedMonths(prev => ({ ...prev, [todayMonthKey]: false }));
      setTimeout(performScroll, 50);
    } else {
      performScroll();
    }
  };

  return (
    <div 
      className={styles.gridContainer} 
      ref={parentRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      style={{ 
        '--glow-rgb': hexToRgbString(themeSettings.hoverGlowColor),
        '--current-day-rgb': hexToRgbString(themeSettings.currentDayColor || '#30d158')
      } as any}
    >
      <div 
        className={styles.gridInner} 
        style={{ height: `${rowVirtualizer.getTotalSize() + 40}px`, width: `${totalWidth}px` }}
      >
        {/* Header */}
        <div className={styles.headerRow}>
          {(() => {
            const virtualItems = rowVirtualizer.getVirtualItems();
            const topVisibleVirtualItem = virtualItems.length > 0 ? virtualItems[0] : null;
            const topOriginalIndex = topVisibleVirtualItem && gridItems[topVisibleVirtualItem.index]?.type === 'row' 
                 ? (gridItems[topVisibleVirtualItem.index] as any).originalIndex 
                 : 0;
            
            return columns.map((col, index) => {
              const activeProjForHeader = col.id !== 'date' && activeProjectsContext[col.id] ? activeProjectsContext[col.id][topOriginalIndex] : null;
              return (
                <div 
                  key={col.id} 
                  className={styles.headerCell} 
                  onClick={index === 0 ? scrollToToday : () => setIsColumnModalOpen(true)}
                  style={{ 
                    width: col.width,
                    cursor: 'default',
                    ...(index === 0 ? { position: 'sticky', left: 0, zIndex: 21, backgroundColor: 'var(--panel-bg)', borderRight: '1px solid var(--border-color)' } : { position: 'relative' })
                  }}
                >
                  {activeProjForHeader && (
                     <div style={{ position: 'absolute', inset: 0, backgroundColor: 'var(--panel-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 22, pointerEvents: 'none' }}>
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: activeProjForHeader.color, opacity: 0.15 }}></div>
                        <span style={{ position: 'relative', fontWeight: 500, color: 'var(--text-primary)' }}>{activeProjForHeader.name}</span>
                     </div>
                  )}
                  {index === 0 ? col.name : <span style={{ color: 'var(--text-secondary)' }}>Столбец {index}</span>}
                </div>
              );
            });
          })()}
        </div>

        {error && (
          <div style={{ padding: '20px', color: 'var(--danger-color)' }}>
            {error}
          </div>
        )}
        {/* Virtualized Rows */}
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const item = gridItems[virtualRow.index];
          
          if (item.type === 'month-header') {
            return (
              <div 
                key={virtualRow.index}
                className={styles.monthHeaderRow}
                style={{
                  top: `${virtualRow.start + 40}px`,
                  height: `${virtualRow.size}px`,
                  width: `${totalWidth}px`
                }}
                onClick={() => toggleMonth(item.monthKey)}
              >
                <div className={styles.monthHeaderContent}>
                  <span className={styles.monthHeaderToggle}>{item.isCollapsed ? '▶' : '▼'}</span> {item.label}
                </div>
              </div>
            );
          }

          const row = item.row;
            return (
              <div 
                key={virtualRow.index}
                className={styles.row}
                style={{
                  top: `${virtualRow.start + 40}px`, // +40 for header
                  height: `${virtualRow.size}px`,
                  width: `${totalWidth}px`
                }}
              >
                {row.rawDate === todayStr && (
                  <div className={styles.currentDayOverlay} />
                )}
                {/* Date Cell (Sticky) */}
                <div 
                  className={`${styles.cell} ${styles.dateCell}`}
                  style={{ width: columns[0].width, cursor: 'default' }}
                  onClick={scrollToToday}
                >
                  {row.date}
                </div>

              {/* Data Columns */}
              {dataColumns.map((col, colIndex) => {
                const actualColIndex = colIndex + 1;
                const cellData = row.data[col.id] || { text: '', color: '' };
                const selected = isCellSelected(virtualRow.index, actualColIndex);
                const activeProjectForCell = activeProjectsContext[col.id]?.[item.originalIndex];
                
                const hasLegacyText = cellData.text && !['Выходной', 'Отсыпной', 'СТОП'].includes(cellData.text.trim()) && cellData.text.trim().length > 0;
                const isWorkingShift = cellData.staff?.length || cellData.dayType || cellData.cars?.length || hasLegacyText;
                const isWeekend = cellData.text === 'Выходной' || cellData.dayType === 'выходной' || cellData.text === 'Отсыпной' || cellData.dayType === 'отсыпной';
                const isStop = cellData.text === 'СТОП' || cellData.dayType === 'стоп';
                const isCellInProject = activeProjectForCell && (isWorkingShift || isWeekend || cellData.cellType === 'shift' || cellData.cellType === 'day_off');
                
                let mappedColor;
                if (cellData.cellType === 'project_start' || (!cellData.cellType && cellData.projectName)) {
                   mappedColor = cellData.color ? (getDarkThemeColor(cellData.color) || cellData.color) : 'var(--primary-color)';
                } else if (isWeekend) {
                   mappedColor = themeSettings.weekendColor;
                } else if (isStop) {
                   mappedColor = themeSettings.stopColor;
                } else if (cellData.dayType === 'павильон') {
                   mappedColor = themeSettings.pavilionColor;
                } else if (cellData.dayType === 'склад') {
                   mappedColor = themeSettings.warehouseColor;
                } else if (cellData.dayType === 'переезд') {
                   mappedColor = themeSettings.transferColor;
                } else if (isWorkingShift) {
                   mappedColor = cellData.color ? (getDarkThemeColor(cellData.color) || cellData.color) : themeSettings.shiftColor;
                } else {
                   mappedColor = undefined;
                }
                
                let cellClass = styles.cell;
                if (selected) cellClass += ` ${styles.selected}`;
                
                if (highlightText || highlightColor || highlightColumnId) {
                  let isMatch = false;
                  if (highlightColumnId === col.id) {
                    isMatch = true;
                  } else {
                    if (highlightText && cellData.text?.includes(highlightText)) isMatch = true;
                    if (highlightColor && cellData.color === highlightColor) isMatch = true;
                  }
                  
                  if (isMatch) cellClass += ` ${styles.highlighted}`;
                  else cellClass += ` ${styles.dimmed}`;
                }

                const textColor = selected ? undefined : (mappedColor ? getContrastYIQ(mappedColor) : undefined);

                return (
                  <div 
                    key={col.id}
                    className={cellClass}
                    style={{ 
                      width: col.width,
                      backgroundColor: selected ? undefined : mappedColor,
                      color: textColor,
                      position: 'relative'
                    }}
                    onMouseDown={() => handleMouseDown(virtualRow.index, actualColIndex)}
                    onMouseEnter={() => handleMouseEnter(virtualRow.index, actualColIndex)}
                    onClick={() => setActiveCell({ rowIndex: virtualRow.index, colIndex: actualColIndex })}
                  >
                    {/* Add a translucent background over custom color if selected */}
                    {selected && mappedColor && (
                      <div className={styles.selectionOverlay} style={{ backgroundColor: mappedColor }}></div>
                    )}
                    {/* Active Project Glow */}
                    {isCellInProject && activeProjectForCell && cellData.cellType !== 'project_start' && (
                      <div style={{ position: 'absolute', inset: 0, boxShadow: `inset 0 0 16px ${activeProjectForCell.color}${isWeekend ? '0D' : '1A'}`, pointerEvents: 'none', zIndex: 1, borderRadius: '4px' }}></div>
                    )}
                    <span className={styles.cellText} style={{ zIndex: 2 }}>
                      {cellData.cellType === 'project_start' || (!cellData.cellType && cellData.projectName) ? (
                         <span style={{ fontWeight: 'bold', color: getContrastYIQ(mappedColor) }}>{cellData.projectName || cellData.text}</span>
                      ) : (
                         <>
                           {cellData.staff && cellData.staff.length > 0 ? cellData.staff.join(', ') : cellData.text}
                           {cellData.cars && cellData.cars.length > 0 && ' 🚗'}
                           {cellData.dayType && cellData.dayType !== 'выходной' && cellData.dayType !== 'отсыпной' && cellData.dayType !== 'стоп' && ` [${cellData.dayType}]`}
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

      {/* Cell Settings Modal */}
      {activeCell && gridItems[activeCell.rowIndex] && gridItems[activeCell.rowIndex].type === 'row' && (
        <CellSettingsModal
          isOpen={true}
          onClose={() => setActiveCell(null)}
          staffList={staffList}
          cars={cars}
          date={(gridItems[activeCell.rowIndex] as any).row.date}
          columnName={columns[activeCell.colIndex].name}
          initialData={(gridItems[activeCell.rowIndex] as any).row.data[columns[activeCell.colIndex].id] || {}}
          activeProject={activeProjectsContext[columns[activeCell.colIndex].id]?.[(gridItems[activeCell.rowIndex] as any).originalIndex] || null}
          onSave={async (newData) => {
            const item = gridItems[activeCell.rowIndex];
            if (item.type !== 'row') return;
            const row = item.row;
            const col = columns[activeCell.colIndex];
            
            const oldCell = row.data[col.id] || ({} as CellData);
            const isDeletingStart = (oldCell as any).cellType === 'project_start' && newData.cellType !== 'project_start';
            
            const isoDate = row.rawDate;
            const fullData = { 
              ...row.data, 
              [col.id]: Object.keys(newData).length === 0 ? undefined : {
                ...row.data[col.id],
                ...newData,
                text: newData.text || '',
                color: newData.color || ''
              }
            };
            if (Object.keys(newData).length === 0) delete fullData[col.id];

            try {
              if (isDeletingStart) {
                 const updates = [];
                 updates.push({ date: isoDate, data: fullData });
                 const newRows = [...rows];
                 newRows[item.originalIndex] = { ...row, data: fullData };
                 
                 for (let i = item.originalIndex + 1; i < rows.length; i++) {
                    const nextRow = rows[i];
                    const nextCell = nextRow.data[col.id] as any;
                    if (nextCell) {
                       const nextFullData = { ...nextRow.data };
                       delete nextFullData[col.id];
                       updates.push({ date: nextRow.rawDate, data: nextFullData });
                       newRows[i] = { ...nextRow, data: nextFullData };
                       if (nextCell.cellType === 'stop' || nextCell.dayType === 'стоп' || nextCell.text === 'СТОП') {
                          break;
                       }
                    }
                 }
                 
                 for (const u of updates) {
                   await apiClient.put('/schedule', u);
                 }
                 setRows(newRows);
              } else {
                 await apiClient.put('/schedule', {
                   date: isoDate,
                   data: fullData
                 });
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
      )}

      {/* Column Settings Modal */}
      <ColumnSettingsModal
        isOpen={isColumnModalOpen}
        onClose={() => setIsColumnModalOpen(false)}
        columns={columns.slice(1)}
        onSave={handleSaveColumns}
      />
    </div>
  );
};
