export default function (app) {
  app.on('browser-window-created', (e, win) => {
    if (!win) {
      return
    }

    win.on('unresponsive', e => {
      console.log('Browser window unresponsive: ', e)
    })

    if (win.webContents) {
      win.webContents.on('crashed', e => {
        console.log('Browser window crashed: ', e)
      })
    }
  })
}

