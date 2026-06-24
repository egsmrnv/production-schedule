import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { apiClient } from '../../api/client';
import { CellSettingsModal } from './CellSettingsModal';
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

        setColumns(newColumns);
        setRows(newRows);
        setError(null);
        if (onDataLoaded) {
          onDataLoaded(newColumns, newRows);
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
  }, [onDataLoaded]);

  const parentRef = useRef<HTMLDivElement>(null);
  
  const [selection, setSelection] = useState<Selection | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
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
        const rowData = [];
        for (let c = minCol; c <= maxCol; c++) {
          const colId = columns[c].id;
          const cell = rows[r].data[colId] || { text: '', color: '' };
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
    } catch(err) {
      // Fallback
    }

    const minRow = Math.min(selection.startRow, selection.endRow);
    const minCol = Math.min(selection.startCol, selection.endCol);

    const newRows = [...rows];

    if (pastedJson && Array.isArray(pastedJson)) {
      for (let r = 0; r < pastedJson.length; r++) {
        const targetRow = minRow + r;
        if (targetRow >= newRows.length) break;

        for (let c = 0; c < pastedJson[r].length; c++) {
          const targetCol = minCol + c;
          if (targetCol >= columns.length) break;

          const colId = columns[targetCol].id;
          newRows[targetRow] = {
            ...newRows[targetRow],
            data: {
              ...newRows[targetRow].data,
              [colId]: {
                text: pastedJson[r][c].text || '',
                color: pastedJson[r][c].color || ''
              }
            }
          };
        }
      }
      setRows(newRows);
      
      // Select the newly pasted area
      setSelection({
        startRow: minRow,
        startCol: minCol,
        endRow: Math.min(minRow + pastedJson.length - 1, newRows.length - 1),
        endCol: Math.min(minCol + pastedJson[0].length - 1, columns.length - 1)
      });
    } else {
      // Plain text paste fallback
      const text = e.clipboardData?.getData('text/plain');
      if (!text) return;
      
      const textRows = text.split('\n');
      for (let r = 0; r < textRows.length; r++) {
        const targetRow = minRow + r;
        if (targetRow >= newRows.length) break;

        const cells = textRows[r].split('\t');
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
  }, [selection, rows, columns]);

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const totalWidth = columns.reduce((acc, col) => acc + col.width, 0);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

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
        <div className={styles.headerRow} style={{ width: `${totalWidth}px` }}>
          {columns.map(col => (
            <div key={col.id} className={styles.headerCell} style={{ width: col.width }}>
              {col.name}
            </div>
          ))}
        </div>

        {error && (
          <div style={{ padding: '20px', color: 'var(--danger-color)' }}>
            {error}
          </div>
        )}
        {/* Virtualized Rows */}
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const row = rows[virtualRow.index];
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
                  style={{ width: columns[0].width, zIndex: 10 }}
              >
                {row.date}
              </div>

              {/* Data Columns */}
              {columns.slice(1).map((col, colIndex) => {
                const actualColIndex = colIndex + 1;
                const cellData = row.data[col.id] || { text: '', color: '' };
                const selected = isCellSelected(virtualRow.index, actualColIndex);
                
                const hasLegacyText = cellData.text && !['Выходной', 'Отсыпной', 'СТОП'].includes(cellData.text.trim()) && cellData.text.trim().length > 0;
                const isWorkingShift = cellData.staff?.length || cellData.dayType || cellData.cars?.length || hasLegacyText;
                const isWeekend = cellData.text === 'Выходной' || cellData.dayType === 'выходной' || cellData.text === 'Отсыпной' || cellData.dayType === 'отсыпной';
                const isStop = cellData.text === 'СТОП' || cellData.dayType === 'стоп';
                
                let mappedColor = cellData.color ? getDarkThemeColor(cellData.color) : undefined;
                if (!mappedColor) {
                  if (isWeekend) mappedColor = themeSettings.weekendColor;
                  else if (isStop) mappedColor = themeSettings.stopColor;
                  else if (cellData.dayType === 'павильон') mappedColor = themeSettings.pavilionColor;
                  else if (cellData.dayType === 'склад') mappedColor = themeSettings.warehouseColor;
                  else if (cellData.dayType === 'переезд') mappedColor = themeSettings.transferColor;
                  else if (isWorkingShift) mappedColor = themeSettings.shiftColor;
                  else mappedColor = themeSettings.emptyCellColor;
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
                      color: textColor
                    }}
                    onMouseDown={() => handleMouseDown(virtualRow.index, actualColIndex)}
                    onMouseEnter={() => handleMouseEnter(virtualRow.index, actualColIndex)}
                    onClick={() => setActiveCell({ rowIndex: virtualRow.index, colIndex: actualColIndex })}
                  >
                    {/* Add a translucent background over custom color if selected */}
                    {selected && mappedColor && (
                      <div className={styles.selectionOverlay} style={{ backgroundColor: mappedColor }}></div>
                    )}
                    <span className={styles.cellText}>
                      {cellData.staff && cellData.staff.length > 0 ? cellData.staff.join(', ') : cellData.text}
                      {cellData.cars && cellData.cars.length > 0 && ' 🚗'}
                      {cellData.dayType && cellData.dayType !== 'выходной' && cellData.dayType !== 'отсыпной' && cellData.dayType !== 'стоп' && ` [${cellData.dayType}]`}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Cell Settings Modal */}
      {activeCell && (
        <CellSettingsModal
          isOpen={true}
          onClose={() => setActiveCell(null)}
          staffList={staffList}
          cars={cars}
          date={rows[activeCell.rowIndex].date}
          columnName={columns[activeCell.colIndex].name}
          initialData={rows[activeCell.rowIndex].data[columns[activeCell.colIndex].id] || {}}
          onSave={async (newData) => {
            const row = rows[activeCell.rowIndex];
            const col = columns[activeCell.colIndex];
            
            const isoDate = row.rawDate;
            const fullData = { 
              ...row.data, 
              [col.id]: {
                ...row.data[col.id],
                ...newData,
                text: newData.text || '',
                color: newData.color || ''
              }
            };

            try {
              await apiClient.put('/schedule', {
                date: isoDate,
                data: fullData
              });
              
              // Update local state
              const newRows = [...rows];
              newRows[activeCell.rowIndex] = { ...row, data: fullData };
              setRows(newRows);
              setActiveCell(null);
            } catch (err) {
              console.error('Failed to save cell data', err);
              alert('Ошибка сохранения');
            }
          }}
        />
      )}

    </div>
  );
};
