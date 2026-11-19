// خطوة 1: بيانات الاجتماع — التاريخ، الاجتماع القادم، المحاور، الملاحظات.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { AutoField } from '../../components/AutoField';
import { DateField } from '../../components/fields';
import { CloseIcon, PlusIcon } from '../../components/icons';
import { SortableList } from '../../components/SortableList';
import { setNextDate, updateMeeting } from '../../db/repos/meetings';
import type { Meeting } from '../../db/types';
import { fmt, t } from '../../i18n';

interface Topic {
  key: string;
  text: string;
}
let seq = 0;
const toTopics = (xs: string[]): Topic[] => xs.map((text) => ({ key: `mt${seq++}`, text }));

export function InfoStep({ meeting }: { meeting: Meeting }) {
  const m = t().meeting;
  const [topics, setTopicsState] = useState<Topic[]>(() => toTopics(meeting.topics));
  const listRef = useRef<HTMLDivElement>(null);

  const setTopics = (next: Topic[]) => {
    setTopicsState(next);
    void updateMeeting(meeting.id, { topics: next.map((x) => x.text) });
  };

  // التركيز على المحور الجديد بعد ما يترسم فعلاً
  const [focusKey, setFocusKey] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!focusKey) return;
    listRef.current?.querySelector<HTMLInputElement>(`[data-k="${focusKey}"] input`)?.focus();
    setFocusKey(null);
  }, [focusKey, topics]);

  const add = () => {
    const [fresh] = toTopics(['']);
    setTopics([...topics, fresh]);
    setFocusKey(fresh.key);
  };

  return (
    <>
      <section class="card">
        <div class="meeting-number">
          <span class="muted">{m.number}</span>
          <b>{meeting.number}</b>
        </div>
        <DateField label={m.date} value={meeting.date} clearable={false} onChange={(v) => v && void updateMeeting(meeting.id, { date: v })} />
        <DateField
          label={m.nextDate}
          value={meeting.nextDate}
          clearable={false}
          onChange={(v) => v && void setNextDate(meeting.id, v)}
          hint={
            <span>
              {meeting.nextDateManual ? m.nextManual : m.nextAuto}
              {meeting.nextDateManual && (
                <>
                  {' · '}
                  <button type="button" class="link-btn" onClick={() => void setNextDate(meeting.id, undefined)}>
                    {m.nextReset}
                  </button>
                </>
              )}
            </span>
          }
        />
      </section>

      <section class="card" ref={listRef}>
        <h2>{m.topics}</h2>
        {topics.length > 0 && (
          <SortableList
            items={topics}
            getKey={(x) => x.key}
            onReorder={setTopics}
            renderItem={(tp, i) => (
              <div class="topic-row" data-k={tp.key}>
                <AutoField
                  value={tp.text}
                  placeholder={fmt(m.topicPlaceholder, { n: i + 1 })}
                  onSave={(text) => {
                    setTopicsState((cur) => {
                      const next = cur.map((x) => (x.key === tp.key ? { ...x, text } : x));
                      void updateMeeting(meeting.id, { topics: next.map((x) => x.text) });
                      return next;
                    });
                  }}
                />
                <button class="icon-btn sm" aria-label={t().drag.remove} onClick={() => setTopics(topics.filter((x) => x.key !== tp.key))}>
                  <CloseIcon width={18} height={18} />
                </button>
              </div>
            )}
          />
        )}
        <button class="btn full" onClick={add}>
          <PlusIcon width={18} height={18} /> {m.addTopic}
        </button>
      </section>

      <section class="card">
        <div class="field">
          <label for="m-notes">{m.notes}</label>
          <AutoField id="m-notes" multiline rows={3} value={meeting.notes} placeholder={m.notesPlaceholder} onSave={(notes) => updateMeeting(meeting.id, { notes })} />
        </div>
      </section>
    </>
  );
}
