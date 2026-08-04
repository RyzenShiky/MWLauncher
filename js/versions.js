// versions.js — builds the final navigation URL for a bookmark, folding in
// optional player/session context as query parameters. Any param the
// target site doesn't recognize is simply ignored by it — this is
// best-effort context passing, not a real launcher protocol.

export function buildLaunchUrl(bookmark, { username, ramGb } = {}) {
  let url;
  try {
    url = new URL(bookmark.url);
  } catch (err) {
    return bookmark.url;
  }
  if (username) url.searchParams.set("username", username);
  if (ramGb) url.searchParams.set("mem", `${ramGb}g`);
  return url.toString();
}
