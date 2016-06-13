/* @flow */

import engine from '../engine'
import type {NotifyCtlSetNotificationsRpc} from '../constants/types/flow-types'

type NotificationChannels = {
  session?: true,
  users?: true,
  kbfs?: true,
  tracking?: true,
  favorites?: true
}

let channelsSet = {}

export default function (channels: NotificationChannels): Promise<void> {
  return new Promise((resolve, reject) => {
    channelsSet = {...channelsSet, ...channels}

    const toSend = {
      session: !!channelsSet.session,
      users: !!channelsSet.users,
      kbfs: !!channelsSet.kbfs,
      tracking: !!channelsSet.tracking,
      favorites: !!channelsSet.favorites
    }

    engine.listenOnConnect('setNotifications', () => {
      const params: NotifyCtlSetNotificationsRpc = {
        method: 'notifyCtl.setNotifications',
        param: {channels: toSend},
        incomingCallMap: {},
        callback: (error, response) => {
          if (error != null) {
            console.warn('error in toggling notifications: ', error)
            reject(error)
          } else {
            resolve()
          }
        }
      }
      engine.rpc(params)
    })
  })
}
