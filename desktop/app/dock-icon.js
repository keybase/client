// @flow

import {app} from 'electron'

// TODO: Let's switch to using app.dock.isVisible if this gets merged:
// https://github.com/electron/electron/pull/6683
let isDockHidden = false

export function showDockIcon () {
  if (isDockHidden) {
    isDockHidden = false
    app.dock && app.dock.show()
    app.emit('-keybase-dock-show', {}, this)
  }
}

export function hideDockIcon () {
  if (!isDockHidden) {
    isDockHidden = true
    app.dock && app.dock.hide()
    app.emit('-keybase-dock-hide', {}, this)
  }
}
