// الإعدادات ← الملفات المصدّرة: نسخة من كل ملف اتصدّر، متجمعة حسب السلسلة. مشاركة تاني، مسح، ومسح القديم.
import { useState } from 'preact/hooks';
import { EmptyState, Screen } from '../../components/Screen';
import { TrashIcon } from '../../components/icons';
import { deleteFiles, deleteFilesOlderThan, getFileBlob, listFiles, STORAGE_WARN_RATIO, storageRatio, type FileMeta } from '../../db/files';
import { useLive } from '../../db/live';
import { shareOrDownload } from '../../export/share';
import { fmt, t } from '../../i18n';
import { formatDate, toISODate } from '../../lib/dates';
import { formatBytes } from '../../lib/platform';

const OLD_DAYS = 90;

export function ExportedFilesScreen() {
  const m = t().exported;
  const files = useLive(() => listFiles(), []);
  const ratio = useLive(() => storageRatio(), [files?.length]);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  const total = (files ?? []).reduce((s, f) => s + f.size, 0);
  // تجميع حسب السلسلة (النسخ الاحتياطية تحت «عام»)
  const groups = new Map<string, FileMeta[]>();
  for (const f of files ?? []) {
    const k = f.seriesName || m.general;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(f);
  }

  const toggle = (id: number) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };
  const share = async (id: number) => {
    const f = await getFileBlob(id);
    if (!f) return;
    try {
      // من غير keep: الملف موجود هنا بالفعل
      await shareOrDownload(f.blob, f.name, f.name);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') alert(fmt(t().common.error, { msg: String(e) }));
    }
  };
  const remove = async (ids: number[]) => {
    if (!ids.length || !confirm(fmt(m.confirmRemove, { n: ids.length }))) return;
    await deleteFiles(ids);
    setPicked(new Set());
    setSelecting(false);
  };
  const removeOld = async () => {
    const old = (files ?? []).filter((f) => f.createdAt < Date.now() - OLD_DAYS * 86_400_000).length;
    if (!old) return alert(m.noneOld);
    if (!confirm(m.confirmOld)) return;
    alert(fmt(m.removedOld, { n: await deleteFilesOlderThan(OLD_DAYS) }));
  };

  return (
    <Screen title={m.title} back="#/settings">
      <p class="muted small">{m.intro}</p>
      {ratio !== undefined && ratio >= STORAGE_WARN_RATIO && <p class="card notice warn">{fmt(m.storageWarn, { pct: Math.round(ratio * 100) })}</p>}
      {files && files.length === 0 && <EmptyState text={m.empty} />}
      {files && files.length > 0 && (
        <>
          <div class="files-bar">
            <b>{fmt(m.total, { n: files.length, size: formatBytes(total) })}</b>
            <button class="btn ghost sm" onClick={() => (setSelecting(!selecting), setPicked(new Set()))}>
              {selecting ? m.cancelSelect : m.select}
            </button>
          </div>
          {selecting && (
            <div class="btn-row tight">
              <button class="btn sm" onClick={() => setPicked(new Set(files.map((f) => f.id!)))}>
                {m.selectAll}
              </button>
              <button class="btn danger sm" disabled={!picked.size} onClick={() => void remove([...picked])}>
                {fmt(m.removeSelected, { n: picked.size })}
              </button>
            </div>
          )}
          {[...groups.entries()].map(([name, list]) => (
            <section class="card flush" key={name}>
              <h2 class="flush-title">{name}</h2>
              <ul class="list">
                {list.map((f) => (
                  <li key={f.id} class="list-row file-row">
                    {selecting && <input type="checkbox" checked={picked.has(f.id!)} onChange={() => toggle(f.id!)} aria-label={f.name} />}
                    <span class="list-main" onClick={() => selecting && toggle(f.id!)}>
                      <span class="list-title file-name" dir="auto">
                        {f.name}
                      </span>
                      <span class="list-sub">
                        {m.kinds[f.kind]} · <span dir="ltr">{formatDate(toISODate(new Date(f.createdAt)))}</span> · <span dir="ltr">{formatBytes(f.size)}</span>
                      </span>
                    </span>
                    {!selecting && (
                      <>
                        <button class="btn sm" onClick={() => void share(f.id!)}>
                          {m.share}
                        </button>
                        <button class="icon-btn sm" aria-label={m.remove} onClick={() => void remove([f.id!])}>
                          <TrashIcon width={18} height={18} />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <button class="btn ghost" onClick={() => void removeOld()}>
            {m.removeOld}
          </button>
        </>
      )}
    </Screen>
  );
}
