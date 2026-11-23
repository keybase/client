import * as C from '@/constants'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {isAndroidNewerThanN} from '@/constants/platform'
import logger from '@/logger'
import * as React from 'react'

const securityGroup = 'security'
const soundGroup = 'sound'
const miscGroup = 'misc'

type NotificationSetting = {
  name: string
  subscribed: boolean
  description: string
}

type ChatGlobalSettingName = 'plaintextmobile' | 'plaintextdesktop' | 'defaultsoundmobile' | 'disabletyping' | 'convertheic'

type NotificationsGroupState = {
  settings: Array<NotificationSetting>
  unsub: boolean
}

const emptyGroups = new Map<string, NotificationsGroupState>()

const isChatGlobalGroup = (groupName: string) =>
  groupName === securityGroup || groupName === soundGroup || groupName === miscGroup

export type UseNotificationSettingsResult = {
  allowEdit: boolean
  groups: Map<string, NotificationsGroupState>
  refresh: () => void
  toggle: (group: string, name?: string) => void
}

export const buildNotificationGroups = (
  loaded: T.RPCChat.NotificationSettingsLocal
): Map<string, NotificationsGroupState> => {
  const groups = new Map<string, NotificationsGroupState>()
  for (const group of loaded.subscriptions ?? []) {
    groups.set(group.name, {
      settings: (group.settings ?? []).map(s => ({...s})),
      unsub: group.unsub,
    })
  }
  const chatGlobal = loaded.chatGlobal.settings
  const isOn = (name: ChatGlobalSettingName) => !!chatGlobal?.[`${T.RPCChat.GlobalAppNotificationSetting[name]}`]

  groups.set(securityGroup, {
    settings: [
      {
        description: 'Show message content in phone chat notifications',
        name: 'plaintextmobile',
        subscribed: isOn('plaintextmobile'),
      },
      {
        description: 'Show message content in computer chat notifications',
        name: 'plaintextdesktop',
        subscribed: isOn('plaintextdesktop'),
      },
      {
        description: "Show others when you're typing",
        name: 'disabletyping',
        subscribed: !isOn('disabletyping'),
      },
    ],
    unsub: false,
  })
  groups.set(soundGroup, {
    settings: isAndroidNewerThanN
      ? []
      : [
          {
            description: 'Phone: use default sound for new messages',
            name: 'defaultsoundmobile',
            subscribed: isOn('defaultsoundmobile'),
          },
        ],
    unsub: false,
  })
  groups.set(miscGroup, {
    settings: [
      {
        description: 'Convert HEIC images to JPEG for chat attachments',
        name: 'convertheic',
        subscribed: isOn('convertheic'),
      },
    ],
    unsub: false,
  })
  return groups
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
): T.RPCChat.MessageTypes['chat.1.local.setNotificationSettingsLocal']['inParam'] => {
  const subscriptions: Array<T.RPCChat.NotificationSubscriptionGroup> = []
  const chatGlobal: {[key: string]: boolean} = {}
  groups.forEach((group, groupName) => {
    if (isChatGlobalGroup(groupName)) {
      group.settings.forEach(setting => {
        chatGlobal[`${T.RPCChat.GlobalAppNotificationSetting[setting.name as ChatGlobalSettingName]}`] =
          setting.name === 'disabletyping' ? !setting.subscribed : setting.subscribed
      })
      return
    }
    subscriptions.push({name: groupName, settings: group.settings, unsub: group.unsub})
  })
  return {chatGlobal, subscriptions}
}

const useNotificationSettings = (): UseNotificationSettingsResult => {
  const loadRPC = C.useRPC(T.RPCChat.localGetNotificationSettingsLocalRpcPromise)
  const saveRPC = C.useRPC(T.RPCChat.localSetNotificationSettingsLocalRpcPromise)
  const [allowEdit, setAllowEdit] = React.useState(false)
  const [groups, setGroups] = React.useState(emptyGroups)

  const refresh = React.useCallback(() => {
    loadRPC(
      [undefined, S.refreshNotificationsWaitingKey],
      loaded => {
        setAllowEdit(true)
        setGroups(buildNotificationGroups(loaded))
      },
      error => {
        logger.warn(`Error getting notification settings: ${error.desc}`)
      }
    )
  }, [loadRPC])

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

      saveRPC(
        [buildNotificationSavePayload(nextGroups), S.waitingKeySettingsGeneric],
        () => setAllowEdit(true),
        error => {
          logger.warn('Failed to save notification settings', error)
          setGroups(prevGroups)
          setAllowEdit(true)
        }
      )
    },
    [allowEdit, groups, saveRPC]
  )

  return {allowEdit, groups, refresh, toggle}
}

export default useNotificationSettings
