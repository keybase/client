// @flow
export default function(app: any) {
  // debugging will make things unresponsive or crash, we don't want to reload
  if (__DEV__) {
    return
  }
  app.on('browser-window-created', (e, win) => {
    if (!win) {
      return
    }

    win.on('unresponsive', e => {
      console.log('Browser window unresponsive: ', e)
      win.reload()
    })

    if (win.webContents) {
      win.webContents.on('crashed', e => {
        console.log('Browser window crashed: ', e)
        win.reload()
      })
    }
  })
}
