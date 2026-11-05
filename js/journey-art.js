/* Original 16 × 16 pixel illustrations for the sunny market. */
var NauJourneyArt = (function () {
  'use strict';
  var shapes = {
    '빵': '<path fill="#80503d" d="M2 5h2V3h8v2h2v8H2z"/><path fill="#eaa36d" d="M3 6h2V4h6v2h2v6H3z"/><path fill="#ffe7b1" d="M4 7h2V5h4v2h2v4H4z"/><path fill="#d59664" d="M5 8h2v1H5zm4 1h2v1H9z"/>',
    '생크림': '<path fill="#8f6a7e" d="M7 1h3v3h2v3h2v5h-2v2H3v-2H1V9h2V6h2V3h2z"/><path fill="#fff9ea" d="M8 2h1v3h2v3h2v3h-2v2H4v-2H2v-1h2V7h2V4h2z"/><path fill="#ecd5d9" d="M5 8h6v1H5zm-1 3h7v1H4z"/>',
    '딸기': '<path fill="#a14457" d="M2 5h12v5h-2v2h-2v2H6v-2H4v-2H2z"/><path fill="#f47886" d="M3 6h10v4h-2v2H9v1H7v-1H5v-2H3z"/><path fill="#488863" d="M4 3h3V1h2v2h3v3H9v1H7V6H4z"/><path fill="#fff0bd" d="M5 7h1v1H5zm5 1h1v1h-1zm-3 2h1v1H7z"/>',
    '초콜릿': '<path fill="#684656" d="M3 1h10v14H3z"/><path fill="#ba8064" d="M4 2h3v3H4zm5 0h3v3H9zM4 6h3v3H4zm5 0h3v3H9zm-5 4h3v3H4zm5 0h3v3H9z"/><path fill="#e6ac85" d="M4 2h3v1H4zm5 0h3v1H9zM4 6h3v1H4zm5 0h3v1H9z"/>',
    '초': '<path fill="#85516c" d="M5 7h6v8H5z"/><path fill="#f6a9be" d="M6 8h4v6H6z"/><path fill="#fff4d0" d="M7 8h2v2H7zm0 4h2v2H7z"/><path fill="#ea9c57" d="M7 1h2v2h2v3H6V3h1z"/><path fill="#ffec9d" d="M8 3h1v2H8z"/>',
    '양말': '<path fill="#6b617f" d="M7 1h7v9h-2v3H3v-2H1V8h6z"/><path fill="#bca8d5" d="M8 2h5v7h-2v3H4v-2H2V9h6z"/><path fill="#f6deef" d="M8 3h5v2H8zM3 9h3v2H3z"/>',
    '벽돌': '<path fill="#92544b" d="M1 3h14v10H1z"/><path fill="#e9957b" d="M2 4h12v8H2z"/><path fill="#a95e50" d="M2 7h12v1H2zm4-3h1v3H6zm4 4h1v4h-1z"/>',
    '다이아몬드': '<path fill="#477692" d="M4 2h8v2h2v3h1v2h-2v2h-2v2H9v2H7v-2H5v-2H3V9H1V7h1V4h2z"/><path fill="#9de8ee" d="M5 3h6v2h2v3H3V5h2z"/><path fill="#63c3d7" d="M4 9h8v2h-2v2H6v-2H4z"/><path fill="#effbfb" d="M5 4h3v3H5z"/>',
    '다이너마이트': '<path fill="#80424b" d="M3 6h10v9H3z"/><path fill="#eb7570" d="M4 7h8v7H4z"/><path fill="#5e5265" d="M3 9h10v2H3zM7 4h2v2H7zm2-2h3v2H9z"/><path fill="#f4ad58" d="M12 1h2v3h-2z"/>',
    '입구': '<path fill="#396a61" d="M2 2h12v13H2z"/><path fill="#a1d8ad" d="M4 4h8v11H4z"/><path fill="#edfae1" d="M5 5h4v5H5z"/><path fill="#396a61" d="M10 10h1v2h-1z"/>',
    '계산대': '<path fill="#446f8a" d="M1 9h14v5H1zm4-7h8v7H5z"/><path fill="#a1dae8" d="M6 3h6v4H6z"/><path fill="#fff2bc" d="M3 10h10v2H3z"/>',
    '케이크': '<path fill="#84576a" d="M2 7h12v7H2zm5-5h2v5H7z"/><path fill="#f7bd87" d="M3 9h10v4H3z"/><path fill="#fff4d9" d="M3 8h10v2H3zm0 3h10v1H3z"/><path fill="#ffc45e" d="M7 1h2v2H7z"/>'
  };
  var recipeIcons = { bread: '빵', cream: '생크림', topping: '딸기', deco: '초' };

  function icon(name) {
    if (!Object.prototype.hasOwnProperty.call(shapes, name)) return '';
    return '<svg class="pixel-icon" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' + shapes[name] + '</svg>';
  }

  function recipe(kind, singleTopping) {
    return icon(recipeIcons[kind]) + (kind === 'topping' && !singleTopping ? icon('초콜릿') : '');
  }

  return { icon: icon, recipe: recipe };
})();
