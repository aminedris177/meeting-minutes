// تقسيم مستند HTML لصفحات A4 ثابتة من غير قطع أي صف جدول أو عنصر قائمة بين صفحتين.
// المصدر: عنصر فيه «بلوكات» (data-block). البلوك اللي فيه جدول/قائمة بيتقسم صف صف،
// وراس الجدول (thead) بيتكرر في كل صفحة، والعنوان مبيفضلش لوحده في آخر الصفحة.

export interface PageSize {
  width: number; // px
  height: number; // px
  padding: number; // px
}

/** A4 عند 96dpi */
export const A4_PORTRAIT: PageSize = { width: 794, height: 1123, padding: 40 };
export const A4_LANDSCAPE: PageSize = { width: 1123, height: 794, padding: 32 };
const FOOTER_SPACE = 22;

export interface PaginateOptions {
  size: PageSize;
  /** كلاس العنصر الخارجي لكل صفحة (علشان نفس الـ CSS) */
  pageClass: string;
  continued: string; // نص «(تابع)» بعد العنوان في الصفحات التالية
  footer: (page: number, total: number) => string;
}

export function paginate(source: HTMLElement, stage: HTMLElement, opts: PaginateOptions): HTMLElement[] {
  const { size } = opts;
  const contentMax = size.height - size.padding * 2 - FOOTER_SPACE;
  const pages: HTMLElement[] = [];
  let content!: HTMLElement;

  const newPage = () => {
    const page = document.createElement('div');
    page.className = `${opts.pageClass} pdf-page`;
    page.dir = source.getAttribute('dir') || 'rtl';
    Object.assign(page.style, {
      width: `${size.width}px`,
      height: `${size.height}px`,
      padding: `${size.padding}px`,
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
      background: '#fff',
    });
    // نفس متغيرات الألوان بتاعة المصدر
    page.setAttribute('style', page.getAttribute('style') + ';' + (source.getAttribute('style') ?? ''));
    content = document.createElement('div');
    content.className = 'pdf-content';
    page.appendChild(content);
    stage.appendChild(page);
    pages.push(page);
  };

  const fits = () => content.scrollHeight <= contentMax + 0.5;
  const isEmpty = () => content.childElementCount === 0;

  /** يحط عنصر؛ لو مدخلش ينقله لصفحة جديدة. لو أكبر من صفحة كاملة → بيتحط على أي حال. */
  const placeWhole = (el: HTMLElement) => {
    content.appendChild(el);
    if (fits() || content.childElementCount === 1) return;
    content.removeChild(el);
    newPage();
    content.appendChild(el);
  };

  const splitSection = (section: HTMLElement) => {
    const heading = section.querySelector<HTMLElement>(':scope > h2, :scope > h3');
    const body = [...section.children].find((c) => c !== heading) as HTMLElement | undefined;
    const table = body?.tagName === 'TABLE' ? (body as HTMLTableElement) : undefined;
    const list = body && (body.tagName === 'OL' || body.tagName === 'UL') ? body : undefined;
    if (!table && !list) return placeWhole(section);

    const items: HTMLElement[] = table ? [...(table.tBodies[0]?.rows ?? [])] : [...list!.children].map((x) => x as HTMLElement);
    let first = true;
    let container!: HTMLElement; // tbody أو ol في الجزء الحالي
    let startNumber = 1;

    const openPart = () => {
      const part = section.cloneNode(false) as HTMLElement;
      if (heading) {
        const h = heading.cloneNode(true) as HTMLElement;
        if (!first) h.textContent = `${heading.textContent} ${opts.continued}`;
        part.appendChild(h);
      }
      if (table) {
        const tb = table.cloneNode(false) as HTMLTableElement;
        if (table.tHead) tb.appendChild(table.tHead.cloneNode(true));
        container = document.createElement('tbody');
        tb.appendChild(container);
        part.appendChild(tb);
      } else {
        const l = list!.cloneNode(false) as HTMLOListElement;
        if (l.tagName === 'OL') l.start = startNumber;
        container = l;
        part.appendChild(l);
      }
      content.appendChild(part);
      return part;
    };

    let part = openPart();
    let placedHere = 0;
    for (const item of items) {
      const node = item.cloneNode(true) as HTMLElement;
      container.appendChild(node);
      if (fits()) {
        placedHere++;
        startNumber++;
        continue;
      }
      container.removeChild(node);
      if (placedHere === 0) {
        // ولا صف دخل: العنوان مينفعش يفضل لوحده — شيل الجزء كله وابدأ صفحة جديدة
        content.removeChild(part);
        if (!isEmpty()) newPage();
      } else {
        newPage();
        first = false;
      }
      part = openPart();
      placedHere = 0;
      container.appendChild(node); // صف أطول من صفحة كاملة بيتحط على أي حال
      placedHere++;
      startNumber++;
    }
  };

  newPage();
  for (const child of [...source.children] as HTMLElement[]) {
    const block = child.cloneNode(true) as HTMLElement;
    if (block.classList.contains('mv-section') || block.hasAttribute('data-split')) {
      // جرّب القسم كله الأول
      content.appendChild(block);
      if (fits()) continue;
      content.removeChild(block);
      splitSection(block);
    } else {
      placeWhole(block);
    }
  }

  // الفوتر (رقم الصفحة)
  pages.forEach((p, i) => {
    const f = document.createElement('div');
    f.className = 'pdf-footer';
    f.textContent = opts.footer(i + 1, pages.length);
    Object.assign(f.style, {
      position: 'absolute',
      left: `${size.padding}px`,
      right: `${size.padding}px`,
      bottom: `${Math.max(12, size.padding / 2)}px`,
      textAlign: 'center',
      fontSize: '10px',
      color: '#9aa5b1',
    });
    p.appendChild(f);
  });
  return pages;
}
