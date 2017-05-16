// @flow
import {app} from 'electron'

export function showDockIcon() {
  if (app.dock && !app.dock.isVisible()) {
    // Be aware that app.dock.isVisible() won't be true immediately
    // after app.dock.show() since there is a slight delay there.
    app.dock.show()
    app.emit('-keybase-dock-showing', {}, this)
  }
}

export function hideDockIcon() {
  if (app.dock && app.dock.isVisible()) {
    app.dock.hide()
    app.emit('-keybase-dock-hide', {}, this)
  }
}
