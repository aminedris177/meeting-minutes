// جولة أول مرة: شرائح قصيرة بصور من التطبيق. بتظهر مرة واحدة، وتقدر تفتحها تاني من الدليل.
import { useEffect, useState } from 'preact/hooks';
import { getLang, t } from '../i18n';

const KEY = 'tourDone';
const EVENT = 'app-tour';

export function isTourDone(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return true;
  }
}
function markDone() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* ignore */
  }
}
export function startTour() {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function Tour() {
  const [show, setShow] = useState(() => !isTourDone());
  const [i, setI] = useState(0);
  useEffect(() => {
    const on = () => {
      setI(0);
      setShow(true);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  if (!show) return null;
  const m = t().tour;
  const slide = m.slides[i];
  const last = i === m.slides.length - 1;
  const close = () => {
    markDone();
    setShow(false);
  };
  return (
    <div class="tour" role="dialog" aria-modal="true" aria-label={slide.title}>
      <div class="tour-card">
        <button class="tour-skip" onClick={close}>
          {m.skip}
        </button>
        <figure class="help-shot tour-shot">
          <img src={`${import.meta.env.BASE_URL}help/${getLang()}/${slide.shot}.jpg`} alt="" />
        </figure>
        <h2>{slide.title}</h2>
        <p>{slide.text}</p>
        <div class="tour-dots" aria-hidden="true">
          {m.slides.map((_, k) => (
            <span class={k === i ? 'on' : ''} />
          ))}
        </div>
        <div class="tour-actions">
          {i > 0 && (
            <button class="btn" onClick={() => setI(i - 1)}>
              {m.back}
            </button>
          )}
          <button class="btn primary" onClick={() => (last ? close() : setI(i + 1))}>
            {last ? m.done : m.next}
          </button>
        </div>
      </div>
    </div>
  );
}
