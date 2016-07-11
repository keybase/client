/* @flow */

import engine from '../engine'
import type {notifyCtlSetNotificationsRpc} from '../constants/types/flow-types'

type NotificationChannels = {
  session?: true,
  users?: true,
  kbfs?: true,
  tracking?: true,
  favorites?: true,
  paperkeys?: true,
  keyfamily?: true,
  service?: true,
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
      favorites: !!channelsSet.favorites,
      paperkeys: !!channelsSet.paperkeys,
      keyfamily: !!channelsSet.keyfamily,
      service: !!channelsSet.service,
    }

    engine.listenOnConnect('setNotifications', () => {
      const params : notifyCtlSetNotificationsRpc = {
        method: 'notifyCtl.setNotifications',
        param: {channels: toSend},
        callback: (error, response) => {
          if (error != null) {
            console.warn('error in toggling notifications: ', error)
            reject(error)
          } else {
            resolve()
          }
        },
      }
      engine.rpc(params)
    })
  })
}
