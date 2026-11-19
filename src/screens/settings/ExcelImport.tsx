// استيراد مهام من ملف Excel (بنفس أعمدة ملف المتابعة) لسلسلة — الملف بيتقري على الجهاز بس.
import { useState } from 'preact/hooks';
import { Sheet } from '../../components/Sheet';
import { Toggle } from '../../components/fields';
import { useLive } from '../../db/live';
import { importTasks } from '../../db/repos/importTasks';
import { db } from '../../db/schema';
import { parseTaskSheets, type ParsedTask, type SheetInput } from '../../domain/excelImport';
import { fmt, isRtl, t } from '../../i18n';
import { formatDate, todayISO } from '../../lib/dates';

export function ExcelImport({ onClose }: { onClose: () => void }) {
  const m = t().excel;
  const seriesList = useLive(async () => (await db.series.toArray()).filter((s) => !s.archived), []);
  const [rows, setRows] = useState<ParsedTask[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [seriesId, setSeriesId] = useState('');
  const [createPeople, setCreatePeople] = useState(true);
  const [busy, setBusy] = useState(false);
  const target = seriesId || seriesList?.[0]?.id || '';

  const read = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setFileName(file.name);
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser');
      const sheets = await readXlsxFile(file);
      // تعريف CellValue في المكتبة فيه DateConstructor بالغلط — القيم الفعلية Date/string/number
      setRows(parseTaskSheets(sheets as unknown as SheetInput[]));
    } catch {
      alert(m.error);
      setRows(null);
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!rows?.length || !target) return;
    setBusy(true);
    try {
      const res = await importTasks(target, rows, todayISO(), { createMissingPeople: createPeople });
      let msg = fmt(m.done, { added: res.added, people: res.newPeople });
      if (res.skipped.length) msg += '\n' + fmt(m.skipped, { n: res.skipped.length, codes: res.skipped.slice(0, 10).join(isRtl() ? '، ' : ', ') });
      alert(msg);
      onClose();
    } catch (e) {
      alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={m.title}
      onClose={onClose}
      footer={
        rows && rows.length > 0 && target ? (
          <>
            <button class="btn primary grow" onClick={run} disabled={busy}>
              {fmt(m.import, { n: rows.length })}
            </button>
            <button class="btn ghost" onClick={onClose}>
              {t().common.cancel}
            </button>
          </>
        ) : undefined
      }
    >
      <p class="muted small">{m.hint}</p>
      {seriesList && seriesList.length === 0 ? (
        <p class="warn">{m.noSeries}</p>
      ) : (
        <>
          <label class="btn full file-btn">
            {busy && !rows ? m.reading : fileName || m.choose}
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden onChange={(e) => void read(e.currentTarget.files?.[0])} />
          </label>

          {rows && rows.length === 0 && <p class="warn">{m.none}</p>}
          {rows && rows.length > 0 && (
            <>
              <h3 class="preview-heading">{fmt(m.found, { n: rows.length })}</h3>
              <div class="field">
                <label for="xl-series">{m.target}</label>
                <select id="xl-series" value={target} onChange={(e) => setSeriesId(e.currentTarget.value)}>
                  {seriesList?.map((s) => (
                    <option value={s.id}>
                      {s.name} ({s.taskPrefix})
                    </option>
                  ))}
                </select>
              </div>
              <Toggle label={m.createPeople} hint={m.createPeopleHint} checked={createPeople} onChange={setCreatePeople} />
              <ul class="list xl-preview">
                {rows.slice(0, 50).map((r) => (
                  <li key={`${r.sheet}-${r.row}`}>
                    <span class="code" dir="ltr">
                      {r.code ?? '—'}
                    </span>
                    <span class="list-main">
                      <span class="list-title">{r.description}</span>
                      <span class="list-sub">
                        {r.ownerName || t().task.unassigned} · {t().task.statusesShort[r.status]}
                        {r.targetDate && (
                          <>
                            {' · '}
                            <span dir="ltr">{formatDate(r.targetDate)}</span>
                          </>
                        )}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}
