/* @flow */

import engine from '../engine'
import {notifyCtlSetNotificationsRpc} from '../constants/types/flow-types'

type NotificationChannels = {
  chat?: true,
  favorites?: true,
  kbfs?: true,
  kbfsrequest?: true,
  keyfamily?: true,
  paperkeys?: true,
  pgp?: true,
  service?: true,
  session?: true,
  tracking?: true,
  users?: true,
}

let channelsSet = {}

export default function (channels: NotificationChannels): Promise<void> {
  return new Promise((resolve, reject) => {
    channelsSet = {...channelsSet, ...channels}

    const toSend = {
      app: !!channelsSet.app,
      chat: !!channelsSet.chat,
      favorites: !!channelsSet.favorites,
      kbfs: !!channelsSet.kbfs,
      kbfsrequest: !!channelsSet.kbfsrequest,
      keyfamily: !!channelsSet.keyfamily,
      paperkeys: !!channelsSet.paperkeys,
      pgp: !!channelsSet.pgp,
      service: !!channelsSet.service,
      session: !!channelsSet.session,
      tracking: !!channelsSet.tracking,
      users: !!channelsSet.users,
    }

    engine().listenOnConnect('setNotifications', () => {
      notifyCtlSetNotificationsRpc({
        param: {channels: toSend},
        callback: (error, response) => {
          if (error != null) {
            console.warn('error in toggling notifications: ', error)
            reject(error)
          } else {
            resolve()
          }
        },
      })
    })
  })
}
