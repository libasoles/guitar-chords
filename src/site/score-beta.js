(function () {
  var betaOpen = document.getElementById('betaOpen');
  var betaPop = document.getElementById('betaPopover');
  function setBeta(open) {
    betaPop.hidden = !open;
    betaOpen.setAttribute('aria-expanded', String(open));
  }
  betaOpen.addEventListener('click', function () { setBeta(betaPop.hidden); });
  document.addEventListener('click', function (event) {
    if (!betaPop.hidden && !betaPop.contains(event.target) && !betaOpen.contains(event.target)) setBeta(false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !betaPop.hidden) { setBeta(false); betaOpen.focus(); }
  });
})();
