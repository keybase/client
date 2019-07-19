import * as SafeElectron from '../../util/safe-electron.desktop'

export function showDockIcon() {
  const app = SafeElectron.getApp()
  const dock = app.dock
  if (dock && !dock.isVisible()) {
    // Be aware that app.dock.isVisible() won't be true immediately
    // after app.dock.show() since there is a slight delay there.
    dock.show()
    app.emit('-keybase-dock-showing', {})
  }
}

export function hideDockIcon() {
  const app = SafeElectron.getApp()
  const dock = app.dock
  if (dock && dock.isVisible()) {
    dock.hide()
    app.emit('-keybase-dock-hide', {})
  }
}
