import * as C from '@/constants'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {isAndroidNewerThanN} from '@/constants/platform'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import * as React from 'react'

const securityGroup = 'security'
const soundGroup = 'sound'
const miscGroup = 'misc'

type NotificationSetting = {
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
        name: NotificationSetting['name']
        subscribed: boolean
      }>
      unsub: boolean
    }
  }
}

type NotificationsGroupState = {
  settings: Array<NotificationSetting>
  unsub: boolean
}

type NotificationSavePayload = {
  JSONPayload: Array<{key: string; value: string}>
  chatGlobalArg: {[key: string]: boolean}
}

const emptyGroups = new Map<string, NotificationsGroupState>()

export const buildNotificationGroups = (
  body: string,
  chatGlobalSettings: T.RPCChat.GlobalAppNotificationSettings
): Map<string, NotificationsGroupState> | undefined => {
  const results = JSON.parse(body) as undefined | NotificationsGroupStateFromServer
  if (!results) return

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
        subscribed: !chatGlobalSettings.settings?.[`${T.RPCChat.GlobalAppNotificationSetting.disabletyping}`],
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
              !!chatGlobalSettings.settings?.[`${T.RPCChat.GlobalAppNotificationSetting.defaultsoundmobile}`],
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
        subscribed: !!chatGlobalSettings.settings?.[`${T.RPCChat.GlobalAppNotificationSetting.convertheic}`],
      },
    ],
    unsub: false,
  }

  return Object.keys(results.notifications).reduce((m, name) => {
    m.set(name, results.notifications[name]!)
    return m
  }, new Map<string, NotificationsGroupState>())
}

export const toggleNotificationGroup = (
  groups: ReadonlyMap<string, NotificationsGroupState>,
  group: string,
  name?: string
) => {
  const groupState = groups.get(group) ?? {settings: [], unsub: false}
  const nextGroups = new Map(groups)
  nextGroups.set(group, {
    settings: groupState.settings.map(setting => {
      let subscribed = setting.subscribed
      if (!name) {
        subscribed = false
      } else if (name === setting.name) {
        subscribed = !subscribed
      }
      return {...setting, subscribed}
    }),
    unsub: !name && !groupState.unsub,
  })
  return nextGroups
}

export const buildNotificationSavePayload = (
  groups: ReadonlyMap<string, NotificationsGroupState>
): NotificationSavePayload => {
  const JSONPayload: Array<{key: string; value: string}> = []
  const chatGlobalArg: {[key: string]: boolean} = {}
  groups.forEach((group, groupName) => {
    if (groupName === securityGroup || groupName === soundGroup || groupName === miscGroup) {
      group.settings.forEach(setting => {
        chatGlobalArg[`${T.RPCChat.GlobalAppNotificationSetting[setting.name]}`] =
          setting.name === 'disabletyping' ? !setting.subscribed : !!setting.subscribed
      })
      return
    }

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
  })
  return {JSONPayload, chatGlobalArg}
}

const useNotificationSettings = () => {
  const loadSubscriptionsRPC = C.useRPC(T.RPCGen.apiserverGetWithSessionRpcPromise)
  const loadGlobalSettingsRPC = C.useRPC(T.RPCChat.localGetGlobalAppNotificationSettingsLocalRpcPromise)
  const saveSubscriptionsRPC = C.useRPC(T.RPCGen.apiserverPostJSONRpcPromise)
  const saveGlobalSettingsRPC = C.useRPC(T.RPCChat.localSetGlobalAppNotificationSettingsLocalRpcPromise)
  const [allowEdit, setAllowEdit] = React.useState(false)
  const [groups, setGroups] = React.useState(emptyGroups)

  const refresh = React.useCallback(() => {
    let handled = false
    const maybeClear = async () => {
      await timeoutPromise(500)
      if (!handled) {
        setAllowEdit(true)
        setGroups(new Map())
      }
    }
    ignorePromise(maybeClear())

    const f = async () => {
      let body = ''
      let chatGlobalSettings: T.RPCChat.GlobalAppNotificationSettings

      try {
        const json = await new Promise<T.RPCGen.APIRes>((resolve, reject) => {
          loadSubscriptionsRPC(
            [{args: [], endpoint: 'account/subscriptions'}, S.refreshNotificationsWaitingKey],
            resolve,
            reject
          )
        })
        chatGlobalSettings = await new Promise<T.RPCChat.GlobalAppNotificationSettings>((resolve, reject) => {
          loadGlobalSettingsRPC([undefined, S.refreshNotificationsWaitingKey], resolve, reject)
        })
        body = json.body
      } catch (error) {
        if (!(error instanceof RPCError)) {
          return
        }
        logger.warn(`Error getting notification settings: ${error.desc}`)
        return
      }

      handled = true
      const nextGroups = buildNotificationGroups(body, chatGlobalSettings)
      if (!nextGroups) return
      setAllowEdit(true)
      setGroups(nextGroups)
    }
    ignorePromise(f())
  }, [loadGlobalSettingsRPC, loadSubscriptionsRPC])

  const toggle = React.useCallback(
    (group: string, name?: string) => {
      if (!groups.get('email')) {
        logger.warn('Trying to toggle while not loaded')
        return
      }
      if (!allowEdit) {
        logger.warn('Trying to toggle while allowEdit false')
        return
      }

      const prevGroups = groups
      const nextGroups = toggleNotificationGroup(groups, group, name)
      setAllowEdit(false)
      setGroups(nextGroups)

      const f = async () => {
        try {
          if (!nextGroups.get('email')) {
            throw new Error('No notifications loaded yet')
          }
          const {JSONPayload, chatGlobalArg} = buildNotificationSavePayload(nextGroups)
          const result = await new Promise<T.RPCGen.APIRes>((resolve, reject) => {
            saveSubscriptionsRPC(
              [
                {
                  JSONPayload,
                  args: [],
                  endpoint: 'account/subscribe',
                },
                S.waitingKeySettingsGeneric,
              ],
              resolve,
              reject
            )
          })
          await new Promise<void>((resolve, reject) => {
            saveGlobalSettingsRPC(
              [{settings: {...chatGlobalArg}}, S.waitingKeySettingsGeneric],
              () => resolve(),
              reject
            )
          })
          if (
            !result.body ||
            (JSON.parse(result.body) as {status?: {code?: number}} | undefined)?.status?.code !== 0
          ) {
            throw new Error(`Invalid response ${result.body || '(no result)'}`)
          }
        } catch (error) {
          logger.warn('Failed to save notification settings', error)
          setGroups(prevGroups)
        } finally {
          setAllowEdit(true)
        }
      }
      ignorePromise(f())
    },
    [allowEdit, groups, saveGlobalSettingsRPC, saveSubscriptionsRPC]
  )

  return {allowEdit, groups, refresh, toggle}
}

export default useNotificationSettings
