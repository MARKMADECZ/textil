/* Markmade – společné měření pro www.markmade.cz (Webnode, HTML hlavička) i textil.markmade.cz (analytics.js).
   Zdroj: web-seo/new/mereni.js -> py sync_mereni.py (zapíše web-seo/new/hlavicka.html a textil/mereni.js).
   - souhlas: www = lišta Webnode (cookieAccepted), textil = vlastní lišta; volba se sdílí cookie mm_consent na .markmade.cz
   - Google Analytics G-YJM27BHX89 v režimu souhlasu (bez souhlasu jen anonymně bez cookies), Clarity se stejným souhlasem
   - interní provoz: ?mm_interni=1 zapne (cookie mm_int na rok), ?mm_interni=0 vypne -> GA traffic_type=internal, Clarity „interni“
   - kliknutí na telefon / e-mail = jedna událost contact_click (method telefon|email), nikoli poptávka
   - mm.lead(typ, číslo, hodnota) = generate_lead právě jednou pro jedno číslo poptávky */
(function (w, d) {
  if (w.mm && w.mm.v) return;
  var GA = 'G-YJM27BHX89', CL = 'yi399eouc2', H = location.hostname;
  var WWW = H === 'www.markmade.cz' || H === 'markmade.cz', TEXTIL = H === 'textil.markmade.cz';
  function ck(n) { var m = d.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : null; }
  function setCk(n, v, age) { d.cookie = n + '=' + encodeURIComponent(v) + ';path=/;max-age=' + age + ';SameSite=Lax' + (/markmade\.cz$/.test(H) ? ';domain=.markmade.cz' : ''); }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  w.clarity = w.clarity || function () { (w.clarity.q = w.clarity.q || []).push(arguments); };

  // ── interní provoz (vlastní testování) ──
  var q = location.search.match(/[?&]mm_interni=([01])/);
  if (q) setCk('mm_int', '1', q[1] === '1' ? 31536000 : 0);
  var internal = q ? q[1] === '1' : ck('mm_int') === '1';
  if (internal) { gtag('set', { traffic_type: 'internal' }); w.clarity('set', 'interni', 'ano'); }

  // ── souhlas ──
  var an = false, mk = false, decided = false;
  if (WWW) {
    var acc = null; try { acc = JSON.parse(ck('cookieAccepted') || 'null'); } catch (e) {}
    if (acc && typeof acc === 'object') {
      decided = true; mk = 'marketing' in acc; an = mk || 'performance' in acc;
      setCk('mm_consent', an ? 'yes' : 'no', 31536000);
    }
    // Při souhlasu s marketingem Webnode výchozí stav souhlasu vůbec nepošle a GA pak hlásí 0 % souhlasu: doplníme ho výslovně
    if (mk) gtag('consent', 'default', { ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted' });
    if (an && !mk) {
      // Webnode povolí analytiku jen spolu s marketingem; souhlas jen s analytickými cookies doplníme do výchozího stavu
      var push = w.dataLayer.push;
      w.dataLayer.push = function (a) { if (a && a[0] === 'consent' && a[1] === 'default' && a[2]) a[2].analytics_storage = 'granted'; return push.apply(this, arguments); };
      d.addEventListener('DOMContentLoaded', function () { (w.gtag || gtag)('consent', 'update', { analytics_storage: 'granted' }); });
    }
  } else if (TEXTIL) {
    var c = ck('mm_consent') || ls('mm_consent');
    decided = c === 'yes' || c === 'no'; an = c === 'yes';
    w.gtag = w.gtag || gtag;
    gtag('consent', 'default', { ad_storage: 'denied', analytics_storage: an ? 'granted' : 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
    gtag('js', new Date()); gtag('config', GA);
    var s = d.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA; d.head.appendChild(s);
    var t = d.createElement('script'); t.async = true; t.src = 'https://www.clarity.ms/tag/' + CL; d.head.appendChild(t);
  }
  w.clarity('consentv2', { ad_Storage: mk ? 'granted' : 'denied', analytics_Storage: an ? 'granted' : 'denied' });

  var mm = w.mm = { v: 1, internal: internal, consent: { analytics: an, marketing: mk, decided: decided } };
  mm.track = function (name, p) {
    try { w.clarity('event', name); } catch (e) {}
    try { (w.gtag || gtag)('event', name, p || {}); } catch (e) {}
  };
  mm.lead = function (type, id, value) {
    var seen = []; try { seen = JSON.parse(ls('mm_leads') || '[]'); } catch (e) {}
    if (id && seen.indexOf(id) >= 0) return false;
    if (id) { seen.push(id); ls('mm_leads', JSON.stringify(seen.slice(-50))); }
    mm.track('generate_lead', { lead_type: type, lead_id: id || '', currency: 'CZK', value: Math.round(value || 0) });
    try { w.clarity('set', 'poptavka', type); w.clarity('upgrade', 'poptavka'); } catch (e) {}
    return true;
  };
  mm.setConsent = function (yes) {
    setCk('mm_consent', yes ? 'yes' : 'no', 31536000); ls('mm_consent', yes ? 'yes' : 'no');
    an = mm.consent.analytics = !!yes; mm.consent.decided = true;
    (w.gtag || gtag)('consent', 'update', { analytics_storage: yes ? 'granted' : 'denied' });
    w.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: yes ? 'granted' : 'denied' });
  };

  // ── lišta souhlasu na textil.markmade.cz (na www ji řeší Webnode) ──
  function banner() {
    var b = d.createElement('div'); b.id = 'mm-cookie'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Souhlas s cookies');
    b.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;background:#1a1a1a;color:#fff;padding:14px 16px;font:14px/1.5 system-ui,sans-serif;box-shadow:0 -2px 12px rgba(0,0,0,.25)';
    b.innerHTML = '<div style="max-width:1100px;margin:0 auto;display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span style="flex:1 1 360px">Se souhlasem používáme analytické cookies (Google Analytics, Microsoft Clarity), abychom web mohli zlepšovat. Bez souhlasu měříme jen anonymně a bez cookies. <a href="https://www.markmade.cz/gdpr/" style="color:#fff;text-decoration:underline">Zásady ochrany osobních údajů</a></span>' +
      '<button type="button" data-c="1" style="background:#b4231a;color:#fff;border:0;border-radius:6px;padding:9px 18px;font:inherit;font-weight:700;cursor:pointer">Povolit</button>' +
      '<button type="button" data-c="0" style="background:transparent;color:#fff;border:1px solid #fff;border-radius:6px;padding:9px 18px;font:inherit;cursor:pointer">Odmítnout</button></div>';
    b.addEventListener('click', function (e) { var x = e.target.closest('[data-c]'); if (!x) return; mm.setConsent(x.getAttribute('data-c') === '1'); b.remove(); });
    d.body.appendChild(b);
  }
  function cookieLink() {
    var p = d.querySelector('footer.site .wrap p:last-child'); if (!p || d.getElementById('mm-cookie-set')) return;
    p.insertAdjacentHTML('beforeend', ' · <a href="#" id="mm-cookie-set">Nastavení cookies</a>');
    d.getElementById('mm-cookie-set').addEventListener('click', function (e) { e.preventDefault(); if (!d.getElementById('mm-cookie')) banner(); });
  }

  // ── telefon / e-mail ──
  var lastC = 0;
  d.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href^="tel:"],a[href^="mailto:"]'); if (!a) return;
    var now = Date.now(); if (now - lastC < 800) return; lastC = now;
    var where = a.closest('footer,#mm-zapati') ? 'paticka' : a.closest('#mmc') ? 'katalog' : a.closest('header,.wnd-header,nav') ? 'hlavicka' : 'obsah';
    mm.track('contact_click', { method: /^tel:/i.test(a.getAttribute('href')) ? 'telefon' : 'email', link_location: where });
  }, true);

  function ready() {
    // starší bloky stránek posílají gtag('event','click',{event_category:'markmade_cta'}): přejmenovat na cta_click,
    // telefon a e-mail vynechat (měří je contact_click výše), ať se nic nepočítá dvakrát
    var g = w.gtag;
    if (typeof g === 'function' && !g.__mm) {
      var f = function (a, b, p) {
        if (a === 'event' && b === 'click' && p && p.event_category === 'markmade_cta') {
          var k = String(p.event_label || '');
          return /phone|call|email|mail/i.test(k) ? undefined : g.call(this, 'event', 'cta_click', { cta: k });
        }
        return g.apply(this, arguments);
      };
      f.__mm = 1; w.gtag = f;
    }
    if (TEXTIL) { cookieLink(); if (!decided) banner(); }
    if (internal && d.body && !d.getElementById('mm-int')) {
      var b = d.createElement('a'); b.id = 'mm-int'; b.href = location.pathname + '?mm_interni=0';
      b.textContent = 'Interní režim · vypnout'; b.title = 'Návštěvy a poptávky z tohoto prohlížeče se počítají jako test';
      b.style.cssText = 'position:fixed;left:8px;top:84px;z-index:2147483000;background:#b4231a;color:#fff;font:600 12px/1 system-ui,sans-serif;padding:7px 10px;border-radius:6px;text-decoration:none;opacity:.85';
      d.body.appendChild(b);
    }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', ready); else ready();
})(window, document);
