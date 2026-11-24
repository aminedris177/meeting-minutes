/* إشعار المتأخر جوه الـ Service Worker (بيتضاف بـ importScripts):
 * - periodicsync «overdue-check»: يقرا IndexedDB (قراءة بس)، يحسب المتأخر، ويحدّث نفس الإشعار (tag ثابت) أو يقفله لو صفر.
 * - notificationclick: يفتح المتابعة على فلتر «المتأخر».
 * النصوص بيكتبها التطبيق في settings.overdueNotify (من ملف الترجمة)، علشان الـ SW ميعرفش اللغة.
 */
(function () {
  var TAG = 'overdue';
  var PERIODIC_TAG = 'overdue-check';
  var DB_NAME = 'meeting-minutes';
  var CLOSED = ['done', 'cancelled'];

  function pad(n) {
    return String(n).padStart(2, '0');
  }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function req(r) {
    return new Promise(function (res, rej) {
      r.onsuccess = function () {
        res(r.result);
      };
      r.onerror = function () {
        rej(r.error);
      };
    });
  }
  function openDb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(DB_NAME);
      // القاعدة مش موجودة لسه: متعملهاش من هنا
      r.onupgradeneeded = function () {
        r.transaction.abort();
      };
      r.onsuccess = function () {
        res(r.result);
      };
      r.onerror = function () {
        rej(r.error);
      };
    });
  }

  /** نفس حساب التطبيق: مهمة مفتوحة، ليها موعد مستهدف عدّى، في سلسلة مش مؤرشفة. */
  function countOverdue(series, tasks, today) {
    var active = {};
    series.forEach(function (s) {
      if (!s.archived) active[s.id] = true;
    });
    var n = 0;
    tasks.forEach(function (t) {
      if (active[t.seriesId] && CLOSED.indexOf(t.status) < 0 && t.targetDate && t.targetDate < today) n++;
    });
    return n;
  }

  async function check(today) {
    var db;
    try {
      db = await openDb();
    } catch (e) {
      return -1;
    }
    try {
      var tx = db.transaction(['settings', 'series', 'tasks'], 'readonly');
      var rows = await Promise.all([req(tx.objectStore('settings').get('overdueNotify')), req(tx.objectStore('series').getAll()), req(tx.objectStore('tasks').getAll())]);
      var cfg = rows[0] && rows[0].value;
      if (!cfg || !cfg.on) return -1;
      var n = countOverdue(rows[1], rows[2], today || todayISO());
      var reg = self.registration;
      var old = await reg.getNotifications({ tag: TAG });
      if (n > 0) {
        await reg.showNotification(cfg.title, {
          tag: TAG,
          body: String(cfg.body).replace('{n}', String(n)),
          icon: 'pwa-192x192.png',
          data: { url: cfg.url },
          // تحديث إشعار موجود من غير صوت
          silent: old.length > 0,
        });
      } else {
        old.forEach(function (x) {
          x.close();
        });
      }
      return n;
    } catch (e) {
      return -1;
    } finally {
      db.close();
    }
  }

  self.addEventListener('periodicsync', function (e) {
    if (e.tag === PERIODIC_TAG) e.waitUntil(check());
  });

  self.addEventListener('notificationclick', function (e) {
    if (e.notification.tag !== TAG) return;
    e.notification.close();
    var data = e.notification.data || {};
    var url = new URL(data.url || './#/followup/overdue', self.registration.scope).href;
    e.waitUntil(
      (async function () {
        var list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (var i = 0; i < list.length; i++) {
          var c = list[i];
          try {
            await c.focus();
            await c.navigate(url);
            return;
          } catch (err) {
            /* جرّب اللي بعده أو افتح نافذة */
          }
        }
        await self.clients.openWindow(url);
      })(),
    );
  });

  // للاختبارات
  self.__overdue = { countOverdue: countOverdue, check: check };
})();
