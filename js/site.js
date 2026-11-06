(function(){
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function(s,c){return (c||document).querySelector(s)};
  var $$ = function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};

  /* Header y menú */
  var hdr = $('header.site');
  var btn = $('.menu-btn');
  if (btn) {
    btn.addEventListener('click', function(){
      var o = document.body.classList.toggle('menu-open'); btn.setAttribute('aria-expanded', o);
    });
    $$('.nav ul a').forEach(function(a){ a.addEventListener('click', function(){
      document.body.classList.remove('menu-open'); btn.setAttribute('aria-expanded', false);
    })});
  }

  /* Títulos palabra por palabra */
  $$('.split').forEach(function(el){
    var html = el.innerHTML.trim();
    // respeta etiquetas internas simples (<span class=...>texto</span>, <br>)
    var tmp = document.createElement('div'); tmp.innerHTML = html;
    var out = [];
    tmp.childNodes.forEach(function(n){
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach(function(t){
          if (!t) return;
          if (/^\s+$/.test(t)) out.push(' ');
          else out.push('<span class="w"><span>' + t + '</span></span>');
        });
      } else if (n.nodeName === 'BR') { out.push('<br>'); }
      else { out.push('<span class="w"><span>' + n.outerHTML + '</span></span>'); }
    });
    el.innerHTML = out.join('');
    $$('.w > span', el).forEach(function(s,i){ s.style.transitionDelay = (i*0.07) + 's'; });
  });

  /* Reveal general */
  var revealEls = $$('.rv, .split, .adn-band, .vsm-photo');
  if (!('IntersectionObserver' in window) || reduce) {
    revealEls.forEach(function(e){ e.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function(en){
      en.forEach(function(e){ if (e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    }, {threshold:.15, rootMargin:'0px 0px -6% 0px'});
    revealEls.forEach(function(e){ io.observe(e); });
  }

  /* Contadores */
  var counters = $$('[data-count]');
  function runCount(el){
    var end = +el.dataset.count, t0 = null, d = 1600;
    if (reduce){ el.textContent = end.toLocaleString('en-US'); return; }
    function step(t){ if(!t0) t0=t; var p=Math.min((t-t0)/d,1), v=Math.round(end*(1-Math.pow(1-p,3)));
      el.textContent = v.toLocaleString('en-US'); if(p<1) requestAnimationFrame(step); }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window){
    var co = new IntersectionObserver(function(en){ en.forEach(function(e){
      if (e.isIntersecting){ co.unobserve(e.target); setTimeout(function(){runCount(e.target)}, +(e.target.dataset.delay||0)); }
    })}, {threshold:.5});
    counters.forEach(function(c){ co.observe(c); });
  }

  /* Contacto: diagonal entra */
  var cont = $('.contacto');
  if (cont && 'IntersectionObserver' in window){
    new IntersectionObserver(function(en){ en.forEach(function(e){ if(e.isIntersecting) cont.classList.add('in-view'); }); },{threshold:.3}).observe(cont);
  }

  /* Scroll: header, parallax del plano, pasos, timeline, indicador */
  var plan = $('.plan');
  var qh = $('.qh'), steps = $$('.step'), qhCur = $('.qh-count .cur'), qhBar = $('.qh-bar i');
  var tl = $('.timeline'), tlFill = $('.tl-fill'), tlItems = $$('.timeline li');
  var dots = $('.dots'), dotLinks = $$('.dots a');
  var sections = dotLinks.map(function(a){ return $(a.getAttribute('href')); });
  var navLinks = $$('.nav ul a[href^="#"]');
  var ticking = false;
  var introEl = $('#a2-intro'), heroEl = $('.hero');
  if (heroEl && introEl && 'IntersectionObserver' in window){
    var ho = new IntersectionObserver(function(en){ if (en[0].isIntersecting){ heroEl.classList.add('hero-in'); ho.disconnect(); } }, {threshold:.35});
    ho.observe(heroEl);
  } else if (heroEl) heroEl.classList.add('hero-in');

  function onScroll(){
    var y = window.scrollY, vh = window.innerHeight;
    if (hdr) hdr.classList.toggle('scrolled', y > 8);

    var heroTop = heroEl ? heroEl.offsetTop : 0;
    if (plan && !reduce) plan.style.transform = 'translate3d(0,' + (Math.max(y - heroTop, 0)*0.18) + 'px,0)';
    if (dots && introEl) dots.classList.toggle('oculto', y < heroTop - vh*0.4);

    if (qh && steps.length && window.innerWidth > 980){
      var r = qh.getBoundingClientRect();
      var total = qh.offsetHeight - vh;
      var p = Math.min(Math.max(-r.top / total, 0), 0.9999);
      var idx = Math.floor(p * steps.length);
      steps.forEach(function(s,i){ s.classList.toggle('on', i===idx); s.classList.toggle('done', i<idx); });
      if (qhCur) qhCur.textContent = '0' + (idx+1);
      if (qhBar) qhBar.style.width = (p*100) + '%';
    }

    if (tl){
      var tr = tl.getBoundingClientRect(), mid = vh*0.6;
      var fp = Math.min(Math.max((mid - tr.top) / (tr.height - 16), 0), 1);
      if (tlFill) tlFill.style.height = 'calc(' + (fp*100) + '% - ' + (fp*16) + 'px)';
      tlItems.forEach(function(li){ li.classList.toggle('on', li.getBoundingClientRect().top < mid); });
    }

    if (dotLinks.length){
      var cur = 0;
      sections.forEach(function(s,i){ if (s && s.getBoundingClientRect().top < vh*0.45) cur = i; });
      dotLinks.forEach(function(a,i){ a.classList.toggle('on', i===cur); });
      var sec = sections[cur];
      if (dots && sec) dots.classList.toggle('dark', sec.getAttribute('data-theme')==='dark');
      var id = sec ? '#' + sec.id : '';
      navLinks.forEach(function(a){ a.classList.toggle('active', a.getAttribute('href')===id); });
    }
    ticking = false;
  }
  window.addEventListener('scroll', function(){ if(!ticking){ ticking=true; requestAnimationFrame(onScroll);} }, {passive:true});
  window.addEventListener('resize', onScroll);
  onScroll();

  /* Filtros portafolio */
  var fb = $$('.filtros button');
  fb.forEach(function(b){ b.addEventListener('click', function(){
    fb.forEach(function(x){ x.setAttribute('aria-pressed','false'); }); b.setAttribute('aria-pressed','true');
    var f = b.dataset.f;
    $$('.obras [data-c]').forEach(function(o){
      var show = f==='all' || o.dataset.c===f;
      o.classList.toggle('hide', !show);
      if (show){ o.classList.remove('in'); void o.offsetWidth; o.classList.add('in'); }
    });
  })});
})();
