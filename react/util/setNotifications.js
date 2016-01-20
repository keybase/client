/* @flow */

import engine from '../engine'

type NotificationChannels = {
  session?: boolean,
  users?: boolean,
  kbfs?: boolean,
  tracking?: boolean
}

let channelsSet = {}

export default function (channels: NotificationChannels): Promise<void> {
  return new Promise((resolve, reject) => {
    channelsSet = {...channelsSet, ...channels}
    engine.listenOnConnect('setNotifications', () => {
      engine.rpc('notifyCtl.setNotifications', {channels: channelsSet}, {}, (error, response) => {
        if (error != null) {
          console.error('error in toggling notifications: ', error)
          reject(error)
        } else {
          resolve()
        }
      })
    })
  })
}
