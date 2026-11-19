// خطوة 4: القرارات — نص + ربط اختياري بمهمة، وترتيب بالسحب.
import { useLayoutEffect, useState } from 'preact/hooks';
import { AutoField } from '../../components/AutoField';
import { CloseIcon, PlusIcon } from '../../components/icons';
import { SortableList } from '../../components/SortableList';
import { useLive } from '../../db/live';
import { addDecision, listDecisions, removeDecision, reorderDecisions, updateDecision } from '../../db/repos/meetings';
import { compareTaskCodes } from '../../domain/numbering';
import { db } from '../../db/schema';
import type { Meeting } from '../../db/types';
import { t } from '../../i18n';

export function DecisionsStep({ meeting }: { meeting: Meeting }) {
  const m = t().meeting;
  const decisions = useLive(() => listDecisions(meeting.id), [meeting.id]);
  const tasks = useLive(
    async () => (await db.tasks.where('seriesId').equals(meeting.seriesId).toArray()).sort((a, b) => compareTaskCodes(a.code, b.code)),
    [meeting.seriesId],
  );

  // القرار الجديد بيظهر بعد ما يتحفظ ويرجع من القراءة الحية — بنركّز عليه أول ما يترسم فعلاً
  const [focusId, setFocusId] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!focusId) return;
    const el = document.querySelector<HTMLTextAreaElement>(`[data-dec="${focusId}"] textarea`);
    if (el) {
      el.focus();
      setFocusId(null);
    }
  }, [focusId, decisions]);

  const add = async () => {
    const dec = await addDecision(meeting.id);
    setFocusId(dec.id);
  };

  return (
    <section class="card">
      <h2>{t().minutes.decisions}</h2>
      {decisions && decisions.length === 0 && <p class="muted">{m.decisionsEmpty}</p>}
      {decisions && decisions.length > 0 && (
        <SortableList
          items={decisions}
          getKey={(x) => x.id}
          onReorder={(xs) => void reorderDecisions(xs.map((x) => x.id))}
          renderItem={(dec, i) => (
            <div class="decision" data-dec={dec.id}>
              <div class="decision-top">
                <span class="order">{i + 1}</span>
                <AutoField
                  multiline
                  rows={2}
                  value={dec.text}
                  placeholder={m.decisionPlaceholder}
                  ariaLabel={`${m.decisionPlaceholder} ${i + 1}`}
                  onSave={(text) => updateDecision(dec.id, { text })}
                />
                <button class="icon-btn sm" aria-label={t().drag.remove} onClick={() => void removeDecision(dec.id)}>
                  <CloseIcon width={18} height={18} />
                </button>
              </div>
              {tasks && tasks.length > 0 && (
                <select
                  class="decision-task"
                  aria-label={m.linkTask}
                  value={dec.taskId ?? ''}
                  onChange={(e) => void updateDecision(dec.id, { taskId: e.currentTarget.value || undefined })}
                >
                  <option value="">
                    {m.linkTask}: {m.noTask}
                  </option>
                  {tasks.map((tk) => (
                    <option value={tk.id}>
                      {tk.code} — {tk.description.slice(0, 50)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}
        />
      )}
      <button class="btn full" onClick={add}>
        <PlusIcon width={18} height={18} /> {m.addDecision}
      </button>
    </section>
  );
}
