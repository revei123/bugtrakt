(function(){
  var t=document.querySelector('[data-menu-toggle]'),m=document.getElementById('mobile-menu');
  if(t&&m){t.addEventListener('click',function(){var o=m.classList.toggle('hidden');t.setAttribute('aria-expanded',String(!o));});
    m.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){m.classList.add('hidden');t.setAttribute('aria-expanded','false');});});}
  var f=document.getElementById('quote-form'); if(!f) return;
  function setErr(el,msg){var box=el.closest('.field'),p=box&&box.querySelector('.err');
    if(msg){el.setAttribute('aria-invalid','true');if(p){p.textContent=msg;p.hidden=false;if(!p.id){p.id=el.id+'-err';}el.setAttribute('aria-describedby',p.id);}}
    else{el.removeAttribute('aria-invalid');if(p){p.hidden=true;p.textContent='';}}}
  function check(el){var bad=el.type==='checkbox'?!el.checked:!el.value.trim();setErr(el,bad?el.dataset.err:'');return !bad;}
  var req=[].slice.call(f.querySelectorAll('[data-err]'));
  req.forEach(function(el){el.addEventListener(el.type==='checkbox'?'change':'input',function(){if(el.getAttribute('aria-invalid'))check(el);});});
  f.addEventListener('submit',function(e){e.preventDefault();var first=null;
    req.forEach(function(el){if(!check(el)&&!first)first=el;});
    if(first){first.focus();return;}
    var ok=document.getElementById('form-ok');f.reset();ok.classList.remove('hidden');ok.focus();});
})();
