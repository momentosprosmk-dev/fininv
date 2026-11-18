(function () {
  window.initFooter = function () {
    var html =
      '© ' + new Date().getFullYear() + ' · FinInv <br> Powered by ' +
      '<a href="https://momentospro.com/" target="_blank" rel="noopener" style="color:inherit; text-decoration:underline;">Momentos Pro</a> · ' +
      '<a href="/tyc/" style="color:inherit; text-decoration:underline;">TyC</a>';
    document.querySelectorAll('.js-texto-footer').forEach(function (el) {
      el.innerHTML = html;
    });
  };
})();
