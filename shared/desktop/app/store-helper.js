// @flow
import {ipcMain} from 'electron'
import {selector as menubarSelector} from '../../menubar/selector'
import {selector as trackerSelector} from '../../tracker/selector'

const componentToSelector: {[key: any]: Function} = {
  tracker: trackerSelector,
  menubar: menubarSelector,
}

export default function(mainWindow: any) {
  const subscribeStoreSubscribers = []
  let store = {}

  ipcMain.on('subscribeStore', (event, component, selectorParams) => {
    let selector = componentToSelector[component]

    if (selector) {
      selector = selector(selectorParams)
    } else {
      throw new Error(`Missing remote selector!: ${component}`)
    }

    const sender = event.sender
    subscribeStoreSubscribers.push({sender, selector})

    try {
      const newStore = selector(store)
      if (newStore) {
        sender.send('stateChange', newStore)
      }
    } catch (_) {}
  })

  ipcMain.on('stateChange', (event, incomingStore) => {
    store = incomingStore

    let dead = []
    subscribeStoreSubscribers.forEach((sub, idx) => {
      try {
        const newStore = sub.selector(store)

        if (newStore) {
          sub.sender.send('stateChange', newStore)
        }
      } catch (_) {
        dead.push(idx)
      }
    })

    // Reverse so the indexes don't shift
    dead.reverse().forEach(idx => {
      subscribeStoreSubscribers.splice(idx, 1)
    })
  })

  ipcMain.on('dispatchAction', (event, action) => {
    mainWindow.window.webContents.send('dispatchAction', action)
  })
}
