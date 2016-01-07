import {ipcMain} from 'electron'

export default function () {
  // In case the subscribe store comes before the remote store is ready
  ipcMain.on('subscribeStore', event => {
    ipcMain.on('remoteStoreReady', () => {
      event.sender.send('resubscribeStore')
    })
  })
}
