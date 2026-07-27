'use strict';

const FORBIDDEN_PAGE = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Session key required</title>
<style>body { font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto; }
h1 { color: #333; } p { color: #666; } code { background: #f0f0f0; padding: 0.1em 0.3em;
  border-radius: 4px; }</style>
</head>
<body><h1>Session key required</h1>
<p>This page needs the full URL your coding agent gave you, including the
<code>?key=&hellip;</code> part. Copy the complete URL and open it again.</p></body></html>`;

function bootstrapPage(key) {
  const jsonKey = JSON.stringify(String(key));
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Opening Brainstorm Companion</title></head>
<body>
<script>
try { sessionStorage.setItem('brainstorm-session-key', ${jsonKey}); } catch (e) {}
location.replace('/');
</script>
</body>
</html>`;
}

module.exports = { FORBIDDEN_PAGE, bootstrapPage };
