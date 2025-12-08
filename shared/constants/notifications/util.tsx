import * as T from '../types'
import * as C from '..'
import * as EngineGen from '@/actions/engine-gen-gen'
import type * as Index from '.'
import {isMobile} from '../platform'
import logger from '@/logger'

export const onEngineConnected = () => {
  const f = async () => {
    try {
      await T.RPCGen.notifyCtlSetNotificationsRpcPromise({
        channels: {
          allowChatNotifySkips: true,
          app: true,
          audit: true,
          badges: true,
          chat: true,
          chatarchive: true,
          chatattachments: true,
          chatdev: false,
          chatemoji: false,
          chatemojicross: false,
          chatkbfsedits: false,
          deviceclone: false,
          ephemeral: false,
          favorites: false,
          featuredBots: true,
          kbfs: true,
          kbfsdesktop: !isMobile,
          kbfslegacy: false,
          kbfsrequest: false,
          kbfssubscription: true,
          keyfamily: false,
          notifysimplefs: true,
          paperkeys: false,
          pgp: true,
          reachability: true,
          runtimestats: true,
          saltpack: true,
          service: true,
          session: true,
          team: true,
          teambot: false,
          tracking: true,
          users: true,
          wallet: false,
        },
      })
    } catch (error) {
      if (error) {
        logger.warn('error in toggling notifications: ', error)
      }
    }
  }
  C.ignorePromise(f())
}

export const onEngineIncoming = (action: EngineGen.Actions) => {
  switch (action.type) {
    case EngineGen.keybase1NotifyAuditRootAuditError:
    case EngineGen.keybase1NotifyAuditBoxAuditError:
    case EngineGen.keybase1NotifyBadgesBadgeState:
      {
        const {useState} = require('.') as typeof Index
        useState.getState().dispatch.onEngineIncomingImpl(action)
      }
      break
    default:
  }
}
