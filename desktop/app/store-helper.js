import {ipcMain} from 'electron'
import {selector as trackerSelector} from '../shared/tracker'
import {selector as menubarSelector} from '../shared/menubar'

export default function (mainWindow) {
  const subscribeStoreSubscribers = []
  let store = {}

  ipcMain.on('subscribeStore', (event, component, selectorParams) => {
    let selector = {
      'tracker': trackerSelector,
      'menubar': menubarSelector
    }[component]

    if (selector) {
      selector = selector(selectorParams)
    }

    const sender = event.sender
    subscribeStoreSubscribers.push({sender, selector})

    try {
      sender.send('stateChange', selector ? selector(store) : store)
    } catch (_) { }
  })

  ipcMain.on('stateChange', (event, incomingStore) => {
    store = incomingStore

    let dead = []
    subscribeStoreSubscribers.forEach((sub, idx) => {
      try {
        sub.sender.send('stateChange', sub.selector ? sub.selector(store) : store)
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
