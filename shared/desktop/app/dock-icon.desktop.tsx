import * as SafeElectron from '../../util/safe-electron.desktop'

const changeDock = (show: boolean) => {
  const app = SafeElectron.getApp()
  const dock = app.dock
  if (!dock) return

  if (show === dock.isVisible()) {
    return
  }

  if (show) {
    dock.show()
  } else {
    dock.hide()
  }

  app.emit('KBappState', '', {payload: {showing: show}, type: 'dock'})
}

export const showDockIcon = () => changeDock(true)
export const hideDockIcon = () => changeDock(false)
