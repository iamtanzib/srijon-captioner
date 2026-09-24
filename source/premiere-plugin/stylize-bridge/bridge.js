(function () {
  function tick() {
    try {
      if (!window.__adobe_cep__ || !window.__adobe_cep__.evalScript) return;
      window.__adobe_cep__.evalScript("SrijonStylizeBridge.tick()", function () {});
    } catch (_) {}
  }
  tick();
  setInterval(tick, 650);
}());
