import {ipcMain} from 'electron'
import {selector as trackerSelector} from '../shared/tracker'
import {selector as menubarSelector} from '../shared/menubar'
import {selector as unlockFoldersSelector} from '../shared/unlock-folders'

export default function (mainWindow) {
  const subscribeStoreSubscribers = []
  let store = {}

  ipcMain.on('subscribeStore', (event, component, selectorParams) => {
    let selector = {
      'tracker': trackerSelector,
      'menubar': menubarSelector,
      'unlockFolders': unlockFoldersSelector,
    }[component]

    if (selector) {
      selector = selector(selectorParams)
    }

    const sender = event.sender
    subscribeStoreSubscribers.push({sender, selector})

    try {
      const newStore = selector ? selector(store) : store
      if (newStore) {
        sender.send('stateChange', newStore)
      }
    } catch (_) { }
  })

  ipcMain.on('stateChange', (event, incomingStore) => {
    store = incomingStore

    let dead = []
    subscribeStoreSubscribers.forEach((sub, idx) => {
      try {
        const newStore = sub.selector ? sub.selector(store) : store
        if (newStore) {
          sub.sender.send('stateChange', newStore)
        }
      } catch (_) {
        dead.push(idx)
      }
    })

    // Reverse so the indexes don't shift
    dead.reverse().forEach(idx => {
      subscribeStoreSubscribers.splice(dead, 1)
    })
  })

  ipcMain.on('dispatchAction', (event, action) => {
    mainWindow.window.webContents.send('dispatchAction', action)
  })
}
