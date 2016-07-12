// @flow

import {app} from 'electron'

let isDockVisible = false

export function showDockIcon () {
  if (!isDockVisible) {
    isDockVisible = true
    app.dock && app.dock.show()
  }
}

export function hideDockIcon () {
  if (isDockVisible) {
    isDockVisible = false
    app.dock && app.dock.hide()
  }
}
