/* @flow */

import engine from '../engine'
import type {notifyCtl_setNotifications_rpc} from '../constants/types/flow-types'

type NotificationChannels = {
  session?: true,
  users?: true,
  kbfs?: true,
  tracking?: true
}

let channelsSet = {}

export default function (channels: NotificationChannels): Promise<void> {
  return new Promise((resolve, reject) => {
    channelsSet = {...channelsSet, ...channels}

    const toSend = {
      session: !!channelsSet.session,
      users: !!channelsSet.users,
      kbfs: !!channelsSet.kbfs,
      tracking: !!channelsSet.tracking
    }

    engine.listenOnConnect('setNotifications', () => {
      const params : notifyCtl_setNotifications_rpc = {
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
