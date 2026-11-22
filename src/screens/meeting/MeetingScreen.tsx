// شاشة الاجتماع: مسودة = خطوات بحفظ تلقائي، ونهائي = صفحة المحضر (تصدير/رجوع لمسودة).
import { useState } from 'preact/hooks';
import { CloseIcon, TrashIcon } from '../../components/icons';
import { Screen } from '../../components/Screen';
import { useLive } from '../../db/live';
import { isLastMeeting } from '../../db/repos/meetings';
import { DeleteMeetingSheet } from './DeleteMeetingSheet';
import { db } from '../../db/schema';
import type { Meeting, Series } from '../../db/types';
import { fmt, t } from '../../i18n';
import { formatDate } from '../../lib/dates';
import { navigate } from '../../lib/router';
import { AttendanceStep } from './AttendanceStep';
import { DecisionsStep } from './DecisionsStep';
import { InfoStep } from './InfoStep';
import { MinutesPanel } from './MinutesPanel';
import { NewTasksStep } from './NewTasksStep';
import { RegisterStep } from './RegisterStep';
import { ReviewStep } from './ReviewStep';

type Step = 'info' | 'attendance' | 'review' | 'decisions' | 'newTasks' | 'register' | 'preview';

export function MeetingScreen({ id }: { id: string }) {
  const meeting = useLive(async () => (await db.meetings.get(id)) ?? null, [id]);
  const series = useLive(async () => (meeting ? ((await db.series.get(meeting.seriesId)) ?? null) : undefined), [meeting?.seriesId]);
  if (meeting === undefined || (meeting && series === undefined)) return <main class="screen" />;
  if (meeting === null || series === null || !series) {
    return (
      <Screen title={t().meeting.notFound} back="#/meetings">
        <a class="btn" href="#/meetings">{t().common.back}</a>
      </Screen>
    );
  }
  if (meeting.status === 'final') return <FinalMeeting meeting={meeting} series={series} />;
  return <MeetingWizard key={meeting.id} meeting={meeting} series={series} />;
}

function FinalMeeting({ meeting, series }: { meeting: Meeting; series: Series }) {
  const last = useLive(() => isLastMeeting(meeting), [meeting.id, meeting.seriesId]);
  const [deleting, setDeleting] = useState(false);
  return (
    <Screen title={`${fmt(t().meetings.meetingN, { n: meeting.number })} · ${formatDate(meeting.date)}`} back={`#/series/${series.id}`}>
      <p class="muted">{series.name}</p>
      <MinutesPanel meeting={meeting} />
      {last && (
        <button class="btn danger-ghost" onClick={() => setDeleting(true)}>
          <TrashIcon width={18} height={18} /> {t().meeting.deleteFinal}
        </button>
      )}
      {deleting && (
        <DeleteMeetingSheet meeting={meeting} onClose={() => setDeleting(false)} onDeleted={() => navigate(`/series/${series.id}`)} />
      )}
    </Screen>
  );
}

function MeetingWizard({ meeting, series }: { meeting: Meeting; series: Series }) {
  const m = t().meeting;
  const steps: Step[] = [
    'info',
    'attendance',
    'review',
    ...(series.sections.decisions ? (['decisions'] as const) : []),
    ...(series.sections.newTasks ? (['newTasks'] as const) : []),
    ...(series.sections.register ? (['register'] as const) : []),
    'preview',
  ];
  const [step, setStep] = useState<Step>('info');
  const idx = Math.max(0, steps.indexOf(step));
  const go = (s: Step) => {
    setStep(s);
    window.scrollTo(0, 0);
  };
  const exit = () => navigate(`/series/${series.id}`);

  const [deleting, setDeleting] = useState(false);
  const removeDraft = () => setDeleting(true);

  return (
    <main class="screen wizard meeting">
      <header class="screen-header">
        <button class="icon-btn" onClick={exit} aria-label={m.done}>
          <CloseIcon />
        </button>
        <h1>
          {fmt(m.title, { n: meeting.number })}
          <small class="header-sub">{series.name}</small>
        </h1>
        <span class="saved-tag">{m.saved}</span>
        <button class="icon-btn" onClick={removeDraft} aria-label={m.deleteDraft} title={m.deleteDraft}>
          <TrashIcon width={20} height={20} />
        </button>
      </header>

      <nav class="steps">
        {steps.map((s, i) => (
          <button key={s} class={`step-tab visited ${s === step ? 'current' : ''}`} onClick={() => go(s)} aria-current={s === step ? 'step' : undefined}>
            <span class="step-num">{i + 1}</span>
            <span class="step-label">{m.steps[s]}</span>
          </button>
        ))}
      </nav>

      <div class="screen-body">
        {step === 'info' && <InfoStep meeting={meeting} />}
        {step === 'attendance' && <AttendanceStep meeting={meeting} />}
        {step === 'review' && <ReviewStep meeting={meeting} />}
        {step === 'decisions' && <DecisionsStep meeting={meeting} />}
        {step === 'newTasks' && <NewTasksStep meeting={meeting} />}
        {step === 'register' && <RegisterStep meeting={meeting} />}
        {step === 'preview' && <MinutesPanel meeting={meeting} />}
        {step === 'info' && (
          <button class="btn danger-ghost" onClick={removeDraft}>
            <TrashIcon width={18} height={18} /> {m.deleteDraft}
          </button>
        )}
      </div>

      <footer class="wizard-footer">
        {idx > 0 && (
          <button class="btn ghost" onClick={() => go(steps[idx - 1])}>
            {m.back}
          </button>
        )}
        {idx < steps.length - 1 ? (
          <button class="btn primary grow" onClick={() => go(steps[idx + 1])}>
            {m.next}
          </button>
        ) : (
          <button class="btn ghost grow" onClick={exit}>
            {m.done}
          </button>
        )}
      </footer>
      {deleting && <DeleteMeetingSheet meeting={meeting} onClose={() => setDeleting(false)} onDeleted={exit} />}
    </main>
  );
}
