import url from 'url'
import events from 'events'
import './preload-main.shared.desktop'
// dev only, needed by dev server

window.KB = {
  ...window.KB,
  DEV: {
    events,
    url,
  },
}
