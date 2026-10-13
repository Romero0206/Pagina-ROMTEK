/* ROMTEK — consentimiento de cookies + Google Analytics 4 (solo con autorización) */
(function(){
  'use strict';
  var GA_ID = 'G-XXXXXXXXXX';            // ← reemplazar por el ID de medición de Google Analytics 4
  var KEY = 'romtek_consent_v1';

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;
  // Consent Mode v2: todo denegado hasta que la persona acepte
  gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});

  function read(){ try{ return localStorage.getItem(KEY); }catch(e){ return null; } }
  function save(v){ try{ localStorage.setItem(KEY,v); }catch(e){} }

  var loaded = false;
  function loadGA(){
    if(loaded || !/^G-[A-Z0-9]{6,}$/.test(GA_ID) || GA_ID === 'G-XXXXXXXXXX') return;
    loaded = true;
    gtag('consent','update',{analytics_storage:'granted'});
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID, {anonymize_ip:true});
  }

  /* Evento de analítica reutilizable (no hace nada sin consentimiento) */
  window.romtekTrack = function(name, params){
    if(read() === 'all') gtag('event', name, params || {});
  };

  function banner(){
    var el = document.getElementById('cc');
    if(el){ el.hidden = false; el.querySelector('.cc-accept').focus(); return; }
    var base = document.documentElement.getAttribute('data-base') || '';
    el = document.createElement('section');
    el.id = 'cc'; el.className = 'cc';
    el.setAttribute('role','dialog'); el.setAttribute('aria-labelledby','cc-t'); el.setAttribute('aria-describedby','cc-d');
    el.innerHTML =
      '<h2 id="cc-t">Usamos cookies</h2>' +
      '<p id="cc-d">Usamos cookies técnicas para que el sitio funcione y, solo si lo aceptas, cookies de analítica para entender cómo se usa la página. ' +
      'Consulta la <a href="' + base + 'politica-cookies.html">política de cookies</a>.</p>' +
      '<div class="cc-actions"><button type="button" class="cc-accept">Aceptar todas</button><button type="button" class="cc-reject">Solo necesarias</button></div>';
    document.body.appendChild(el);
    el.querySelector('.cc-accept').addEventListener('click', function(){ save('all'); el.hidden = true; loadGA(); });
    el.querySelector('.cc-reject').addEventListener('click', function(){
      var was = read() === 'all';
      save('necessary'); el.hidden = true;
      if(was) location.reload();   // desactiva la analítica ya cargada
    });
  }

  function init(){
    var c = read();
    if(c === 'all') loadGA();
    else if(c !== 'necessary') banner();

    document.querySelectorAll('[data-cc-open]').forEach(function(b){
      b.addEventListener('click', function(e){ e.preventDefault(); banner(); });
    });
    document.querySelectorAll('a[href^="https://wa.me/"]').forEach(function(a){
      a.addEventListener('click', function(){ window.romtekTrack('whatsapp_click', {link_location: a.dataset.loc || 'pagina'}); });
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
