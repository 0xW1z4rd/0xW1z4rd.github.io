/* Wizard Blog — search.js */

var searchIndex = [];
var searchLoaded = false;

function loadIndex() {
  if (searchLoaded) return Promise.resolve();
  return fetch('/search.json')
    .then(function (r) { return r.json(); })
    .then(function (data) { searchIndex = data; searchLoaded = true; })
    .catch(function (e) { console.warn('Search index unavailable', e); });
}

function escape(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlight(text, query) {
  return text.replace(new RegExp('(' + escape(query) + ')', 'gi'), '<mark>$1</mark>');
}

function runSearch(query) {
  if (!query || query.length < 2) return [];
  var q = query.toLowerCase();
  return searchIndex.filter(function (post) {
    return (
      post.title.toLowerCase().indexOf(q) !== -1 ||
      post.content.toLowerCase().indexOf(q) !== -1 ||
      (post.tags && post.tags.join(' ').toLowerCase().indexOf(q) !== -1) ||
      (post.categories && post.categories.join(' ').toLowerCase().indexOf(q) !== -1)
    );
  }).slice(0, 10);
}

function renderResults(results, query) {
  var container = document.getElementById('search-results');
  if (!container) return;

  if (!results.length) {
    container.innerHTML = '<p class="search-empty">No results for &ldquo;<strong>' + query + '</strong>&rdquo;</p>';
    return;
  }

  container.innerHTML = results.map(function (post) {
    var excerpt = post.content ? post.content.substring(0, 120) + '&hellip;' : '';
    return [
      '<a href="' + post.url + '" class="search-result-item" tabindex="0">',
      '<span class="search-result-title">' + highlight(post.title, query) + '</span>',
      '<span class="search-result-meta">' + post.date + (post.categories && post.categories.length ? ' &middot; ' + post.categories.join(', ') : '') + '</span>',
      excerpt ? '<span class="search-result-excerpt">' + highlight(excerpt, query) + '</span>' : '',
      '</a>',
    ].join('');
  }).join('');
}

(function () {
  var input = document.getElementById('search-input');
  if (!input) return;

  var timer;

  input.addEventListener('focus', loadIndex);

  input.addEventListener('input', function () {
    clearTimeout(timer);
    var q = input.value.trim();

    if (!q || q.length < 2) {
      var c = document.getElementById('search-results');
      if (c) c.innerHTML = '';
      return;
    }

    timer = setTimeout(function () {
      if (!searchLoaded) {
        loadIndex().then(function () { renderResults(runSearch(q), q); });
      } else {
        renderResults(runSearch(q), q);
      }
    }, 180);
  });
})();
