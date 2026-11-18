// قائمة قابلة لإعادة الترتيب بالسحب من مقبض ⠿ (لمس أو ماوس).
// أثناء السحب الترتيب بيتغير مباشرة لما الصف يعدّي نص الصف اللي جنبه.
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { GripIcon } from './icons';

interface Props<T> {
  items: T[];
  getKey: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ComponentChildren;
}

interface DragState {
  key: string;
  pointerId: number;
  startY: number;
  order: string[];
}

export function SortableList<T>({ items, getKey, onReorder, renderItem }: Props<T>) {
  const rows = useRef(new Map<string, HTMLElement>());
  const drag = useRef<DragState | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const byKey = new Map(items.map((it) => [getKey(it), it]));
  const keys = order ?? items.map(getKey);

  const onPointerDown = (key: string, e: PointerEvent) => {
    if (e.button !== 0 || drag.current) return;
    e.preventDefault();
    // باللمس الـ capture بيحصل تلقائياً، وبالماوس لازم نطلبه
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* بعض المتصفحات بترفض لو الـ pointer خلص */
    }
    drag.current = { key, pointerId: e.pointerId, startY: e.clientY, order: items.map(getKey) };
    setOrder(drag.current.order);
    setDragKey(key);
    setOffset(0);
  };

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    let dy = e.clientY - d.startY;
    let i = d.order.indexOf(d.key);
    let changed = false;
    // تبديل مع الجار طالما عدّينا نصه
    for (;;) {
      if (dy > 0 && i < d.order.length - 1) {
        const h = rows.current.get(d.order[i + 1])?.offsetHeight ?? 0;
        if (h && dy > h / 2) {
          [d.order[i], d.order[i + 1]] = [d.order[i + 1], d.order[i]];
          d.startY += h;
          dy -= h;
          i++;
          changed = true;
          continue;
        }
      } else if (dy < 0 && i > 0) {
        const h = rows.current.get(d.order[i - 1])?.offsetHeight ?? 0;
        if (h && -dy > h / 2) {
          [d.order[i], d.order[i - 1]] = [d.order[i - 1], d.order[i]];
          d.startY -= h;
          dy += h;
          i--;
          changed = true;
          continue;
        }
      }
      break;
    }
    if (changed) setOrder([...d.order]);
    setOffset(dy);
  };

  const finish = () => {
    const d = drag.current;
    drag.current = null;
    setDragKey(null);
    setOffset(0);
    setOrder(null);
    if (!d) return;
    const original = items.map(getKey);
    if (d.order.some((k, i) => k !== original[i])) {
      onReorder(d.order.map((k) => byKey.get(k)!).filter(Boolean));
    }
  };

  return (
    <ul class="sortable">
      {keys.map((key, index) => {
        const item = byKey.get(key);
        if (item === undefined) return null;
        const dragging = key === dragKey;
        return (
          <li
            key={key}
            ref={(el) => {
              if (el) rows.current.set(key, el);
              else rows.current.delete(key);
            }}
            class={`sortable-row ${dragging ? 'dragging' : ''}`}
            style={dragging ? { transform: `translateY(${offset}px)` } : undefined}
          >
            <button
              type="button"
              class="drag-handle"
              aria-label={t().drag.handle}
              onPointerDown={(e) => onPointerDown(key, e)}
              onPointerMove={onPointerMove}
              onPointerUp={finish}
              onPointerCancel={finish}
              onLostPointerCapture={finish}
              onContextMenu={(e) => e.preventDefault()}
            >
              <GripIcon />
            </button>
            <div class="sortable-content">{renderItem(item, index)}</div>
          </li>
        );
      })}
    </ul>
  );
}
