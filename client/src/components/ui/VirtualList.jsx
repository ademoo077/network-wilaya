import { useEffect, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

function WindowedList({ items, render, rowHeight, className, scrollToId }) {
  const ref = useRef(null);
  const virtualizer = useVirtualizer({ count: items.length, getScrollElement: () => ref.current, estimateSize: () => rowHeight, overscan: 5 });
  useEffect(() => { const index = items.findIndex((item) => item.id === scrollToId); if (index >= 0) virtualizer.scrollToIndex(index, { align: 'auto' }); }, [scrollToId, items, virtualizer]);
  return <div ref={ref} className={`overflow-auto ${className}`}>
    <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }} role="list">
      {virtualizer.getVirtualItems().map((row) => <div key={items[row.index].id} role="listitem" aria-posinset={row.index + 1} aria-setsize={items.length}
         data-index={row.index} ref={virtualizer.measureElement} className="absolute inset-x-0 top-0" style={{ minHeight: rowHeight, transform: `translateY(${row.start}px)` }}>{render(items[row.index], row.index)}</div>)}
    </div></div>;
}
export default function VirtualList({ items = [], render, rowHeight = 108, className = '', scrollToId }) {
  const ref = useRef(null);
  useEffect(() => {
    const index = items.findIndex((item) => item.id === scrollToId); const container = ref.current; const row = container?.children[index];
    if (row && (row.offsetTop < container.scrollTop || row.offsetTop + row.offsetHeight > container.scrollTop + container.clientHeight)) container.scrollTo({ top: row.offsetTop });
  }, [scrollToId, items]);
  return items.length > 200 ? <WindowedList {...{ items, render, rowHeight, className, scrollToId }} />
    : <div ref={ref} className={`relative overflow-auto ${className}`} role="list">{items.map((item, index) => <div role="listitem" key={item.id}>{render(item, index)}</div>)}</div>;
}
