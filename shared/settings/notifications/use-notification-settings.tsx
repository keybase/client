import * as C from '@/constants'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {isAndroidNewerThanN} from '@/constants/platform'
import {ignorePromise} from '@/constants/utils'
import logger from '@/logger'
import * as React from 'react'

const securityGroup = 'security'
const soundGroup = 'sound'
const miscGroup = 'misc'

// newmessages is not a chat setting the screen shows
type ChatGlobalSettingName = Exclude<keyof typeof T.RPCChat.GlobalAppNotificationSetting, 'newmessages'>

type NotificationsGroupState = {
  settings: ReadonlyArray<T.RPCChat.NotificationSubscription>
  unsub: boolean
}

const emptyGroups = new Map<string, NotificationsGroupState>()

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
      settings: group.settings ?? [],
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
    if (groupName === securityGroup || groupName === soundGroup || groupName === miscGroup) {
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

// Resolves false on any failure, a cancel included
const saveNotificationSettings = async (groups: ReadonlyMap<string, NotificationsGroupState>) => {
  try {
    await T.RPCChat.localSetNotificationSettingsLocalRpcPromise(
      buildNotificationSavePayload(groups),
      S.waitingKeySettingsGeneric
    )
    return true
  } catch (error) {
    logger.warn('Failed to save notification settings', error)
    return false
  }
}

const useNotificationSettings = (): UseNotificationSettingsResult => {
  const loadRPC = C.useRPC(T.RPCChat.localGetNotificationSettingsLocalRpcPromise)
  const [allowEdit, setAllowEdit] = React.useState(false)
  const [groups, setGroups] = React.useState(emptyGroups)
  // A load that overlaps a save may read the settings from before it, so its
  // answer is dropped: savingRef covers a save still in flight, and the epoch
  // (bumped when a save settles) one that settled while the load was out.
  const savingRef = React.useRef(false)
  const saveEpochRef = React.useRef(0)

  const refresh = React.useCallback(() => {
    const epoch = saveEpochRef.current
    loadRPC(
      [undefined, S.refreshNotificationsWaitingKey],
      loaded => {
        if (savingRef.current || saveEpochRef.current !== epoch) {
          return
        }
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
      savingRef.current = true

      // Called directly rather than through useRPC, which drops a quiet cancel:
      // editing must come back however the save ends.
      const save = async () => {
        const saved = await saveNotificationSettings(nextGroups)
        savingRef.current = false
        saveEpochRef.current++
        setAllowEdit(true)
        // part of a failed save may have landed (nothing is rolled back), so
        // show the old values until the refresh brings what the server has
        if (!saved) {
          setGroups(prevGroups)
          refresh()
        }
      }
      ignorePromise(save())
    },
    [allowEdit, groups, refresh]
  )

  return {allowEdit, groups, refresh, toggle}
}

export default useNotificationSettings
