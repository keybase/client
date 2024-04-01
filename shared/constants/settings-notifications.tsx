import * as Z from '@/util/zustand'
import * as C from '@/constants'
import {isAndroidNewerThanN} from '@/constants/platform'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import * as T from './types'

const securityGroup = 'security'
const soundGroup = 'sound'
const miscGroup = 'misc'
const settingsWaitingKey = 'settings:generic'
export const refreshNotificationsWaitingKey = 'settingsTabs.refreshNotifications'

export type NotificationsSettingsState = {
  name:
    | 'newmessages'
    | 'plaintextmobile'
    | 'plaintextdesktop'
    | 'defaultsoundmobile'
    | 'disabletyping'
    | 'convertheic'
  subscribed: boolean
  description: string
}

type NotificationsGroupStateFromServer = {
  notifications: {
    [key: string]: {
      settings: Array<{
        description: string
        description_h: string
        name: NotificationsSettingsState['name']
        subscribed: boolean
      }>
      unsub: boolean
    }
  }
}

export type NotificationsGroupState = {
  settings: Array<NotificationsSettingsState>
  unsub: boolean
}

type Store = T.Immutable<{
  allowEdit: boolean
  groups: Map<string, NotificationsGroupState>
}>

const initialStore: Store = {
  allowEdit: false,
  groups: new Map(),
}

export interface State extends Store {
  dispatch: {
    resetState: 'default'
    toggle: (group: string, name?: string) => void
    refresh: () => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    refresh: () => {
      const f = async () => {
        let handled = false
        // If the rpc is fast don't clear it out first
        const maybeClear = async () => {
          await C.timeoutPromise(500)
          if (!handled) {
            set(s => {
              s.allowEdit = true
              s.groups = new Map()
            })
          }
        }
        C.ignorePromise(maybeClear())

        let body = ''
        let chatGlobalSettings: T.RPCChat.GlobalAppNotificationSettings

        try {
          const json = await T.RPCGen.apiserverGetWithSessionRpcPromise(
            {args: [], endpoint: 'account/subscriptions'},
            refreshNotificationsWaitingKey
          )
          chatGlobalSettings = await T.RPCChat.localGetGlobalAppNotificationSettingsLocalRpcPromise(
            undefined,
            refreshNotificationsWaitingKey
          )
          body = json.body
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          // No need to throw black bars -- handled by Reloadable.
          logger.warn(`Error getting notification settings: ${error.desc}`)
          return
        }

        handled = true

        const results = JSON.parse(body) as undefined | NotificationsGroupStateFromServer
        if (!results) return
        // Add security group extra since it does not come from API endpoint
        results.notifications[securityGroup] = {
          settings: [
            {
              description: 'Show message content in phone chat notifications',
              description_h: 'Show message content in phone chat notifications',
              name: 'plaintextmobile',
              subscribed:
                !!chatGlobalSettings.settings?.[`${T.RPCChat.GlobalAppNotificationSetting.plaintextmobile}`],
            },
            {
              description: 'Show message content in computer chat notifications',
              description_h: 'Show message content in computer chat notifications',
              name: 'plaintextdesktop',
              subscribed:
                !!chatGlobalSettings.settings?.[`${T.RPCChat.GlobalAppNotificationSetting.plaintextdesktop}`],
            },
            {
              description: "Show others when you're typing",
              description_h: "Show others when you're typing",
              name: 'disabletyping',
              subscribed:
                !chatGlobalSettings.settings?.[`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`],
            },
          ],
          unsub: false,
        }
        results.notifications[soundGroup] = {
          settings: isAndroidNewerThanN
            ? []
            : [
                {
                  description: 'Phone: use default sound for new messages',
                  description_h: 'Phone: use default sound for new messages',
                  name: 'defaultsoundmobile',
                  subscribed:
                    !!chatGlobalSettings.settings?.[
                      `${T.RPCChat.GlobalAppNotificationSetting.defaultsoundmobile}`
                    ],
                } as const,
              ],
          unsub: false,
        }
        results.notifications[miscGroup] = {
          settings: [
            {
              description: 'Convert HEIC images to JPEG for chat attachments',
              description_h: 'Convert HEIC images to JPEG for chat attachments',
              name: 'convertheic',
              subscribed:
                !!chatGlobalSettings.settings?.[`${T.RPCChat.GlobalAppNotificationSetting.convertheic}`],
            },
          ],
          unsub: false,
        }

        set(s => {
          s.allowEdit = true
          s.groups = Object.keys(results.notifications).reduce((m, n) => {
            m.set(n, results.notifications[n]!)
            return m
          }, new Map<string, NotificationsGroupState>())
        })
      }
      C.ignorePromise(f())
    },
    resetState: 'default',
    toggle: (group, name) => {
      const {groups} = get()
      if (!groups.get('email')) {
        logger.warn('Trying to toggle while not loaded')
        return
      }

      if (!get().allowEdit) {
        logger.warn('Trying to toggle while allowEdit false')
        return
      }

      const updateSubscribe = (setting: NotificationsSettingsState, storeGroup: string) => {
        let subscribed = setting.subscribed
        if (!name) {
          // clicked unsub all
          subscribed = false
        } else if (name === setting.name && group === storeGroup) {
          // flip if it's the one we're looking for
          subscribed = !subscribed
        }
        return {...setting, subscribed}
      }

      const groupMap = get().groups.get(group) ?? {
        settings: [],
        unsub: false,
      }

      const {settings, unsub} = groupMap

      set(s => {
        s.allowEdit = false
        s.groups.set(group, {
          settings: settings.map(s => updateSubscribe(s, group)),
          // No name means toggle the unsubscribe option
          unsub: !name && !unsub,
        })
      })

      const f = async () => {
        const {groups} = get()
        if (!groups.get('email')) {
          throw new Error('No notifications loaded yet')
        }

        const JSONPayload: Array<{key: string; value: string}> = []
        const chatGlobalArg: {[key: string]: boolean} = {}
        groups.forEach((group, groupName) => {
          if (groupName === securityGroup || groupName === soundGroup || groupName === miscGroup) {
            // Special case this since it will go to chat settings endpoint
            group.settings.forEach(
              setting =>
                (chatGlobalArg[`${T.RPCChat.GlobalAppNotificationSetting[setting.name]}`] =
                  setting.name === 'disabletyping' ? !setting.subscribed : !!setting.subscribed)
            )
          } else {
            group.settings.forEach(setting =>
              JSONPayload.push({
                key: `${setting.name}|${groupName}`,
                value: setting.subscribed ? '1' : '0',
              })
            )
            JSONPayload.push({
              key: `unsub|${groupName}`,
              value: group.unsub ? '1' : '0',
            })
          }
        })

        const result = await T.RPCGen.apiserverPostJSONRpcPromise(
          {
            JSONPayload,
            args: [],
            endpoint: 'account/subscribe',
          },
          settingsWaitingKey
        )
        await T.RPCChat.localSetGlobalAppNotificationSettingsLocalRpcPromise(
          {settings: {...chatGlobalArg}},
          settingsWaitingKey
        )

        if (
          !result.body ||
          (JSON.parse(result.body) as {status?: {code?: number}} | undefined)?.status?.code !== 0
        ) {
          throw new Error(`Invalid response ${result.body || '(no result)'}`)
        }
        set(s => {
          s.allowEdit = true
        })
      }
      C.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
