// الرجوع لأول الشاشة عند تغيير الشاشة.
// على iOS: لو الشاشة القديمة لسه بتتمرر (momentum) وانت دوست على تبويب، scrollTo لوحده بيتجاهَل،
// فالشاشة الجديدة (لو أقصر) بتظهر فاضية. الحل: نوقف التمرير لحظة (overflow hidden) ونرجع لأول الصفحة كذا مرة.
export function resetScroll(): void {
  const el = document.scrollingElement ?? document.documentElement;
  const root = document.documentElement;
  const top = () => {
    el.scrollTop = 0;
    window.scrollTo(0, 0);
  };
  root.style.overflow = 'hidden';
  top();
  requestAnimationFrame(() => {
    top();
    root.style.overflow = '';
    setTimeout(top, 60);
  });
}
