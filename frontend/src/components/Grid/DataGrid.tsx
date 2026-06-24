import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { apiClient } from '../../api/client';
import styles from './DataGrid.module.css';

interface Column {
  id: string;
  name: string;
  width: number;
}

interface Row {
  date: string;
  data: Record<string, CellData>;
}

interface CellData {
  text: string;
  color: string;
}

interface Selection {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export const DataGrid: React.FC = () => {
  const [columns, setColumns] = useState<Column[]>([
    { id: 'date', name: 'Дата', width: 100 }
  ]);

  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

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
            data: d.data
          };
        });

        setColumns(newColumns);
        setRows(newRows);
        setError(null);
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
  }, []);

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

  return (
    <div 
      className={styles.gridContainer} 
      ref={parentRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div 
        className={styles.gridInner} 
        style={{ height: `${rowVirtualizer.getTotalSize() + 40}px`, width: `${totalWidth}px` }}
      >
        {/* Header */}
        <div className={styles.headerRow}>
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
              key={virtualRow.key}
              className={styles.row}
              style={{
                top: `${virtualRow.start + 40}px`, // +40 for header
                height: `${virtualRow.size}px`
              }}
            >
              {/* Date Column (fixed/frozen look) */}
              <div 
                className={`${styles.cell} ${styles.dateCell}`} 
                style={{ width: columns[0].width }}
              >
                {row.date}
              </div>

              {/* Data Columns */}
              {columns.slice(1).map((col, colIndex) => {
                const actualColIndex = colIndex + 1;
                const cellData = row.data[col.id] || { text: '', color: '' };
                const selected = isCellSelected(virtualRow.index, actualColIndex);
                
                return (
                  <div 
                    key={col.id}
                    className={`${styles.cell} ${selected ? styles.selected : ''}`}
                    style={{ 
                      width: col.width,
                      backgroundColor: selected ? undefined : (cellData.color || undefined) 
                    }}
                    onMouseDown={() => handleMouseDown(virtualRow.index, actualColIndex)}
                    onMouseEnter={() => handleMouseEnter(virtualRow.index, actualColIndex)}
                  >
                    {/* Add a translucent background over custom color if selected */}
                    {selected && cellData.color && (
                      <div className={styles.selectionOverlay} style={{ backgroundColor: cellData.color }}></div>
                    )}
                    <span className={styles.cellText}>{cellData.text}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
