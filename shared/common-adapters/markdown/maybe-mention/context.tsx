import {getTeamMentionName} from '@/constants/chat/helpers'
import type * as T from '@/constants/types'
import {useEngineActionListener} from '@/engine/action-listener'
import * as React from 'react'

type MaybeMentionInfo = T.RPCChat.UIMaybeMentionInfo

const MaybeMentionContext = React.createContext<ReadonlyMap<string, MaybeMentionInfo> | undefined>(undefined)

type ProviderProps = {
  children: React.ReactNode
}

export const MaybeMentionProvider = (props: ProviderProps) => {
  const [infoMap, setInfoMap] = React.useState<ReadonlyMap<string, MaybeMentionInfo>>(() => new Map())

  useEngineActionListener('chat.1.chatUi.chatMaybeMentionUpdate', action => {
    const {teamName, channel, info} = action.payload.params
    const key = getTeamMentionName(teamName, channel)
    setInfoMap(oldMap => {
      const oldInfo = oldMap.get(key)
      if (oldInfo === info) {
        return oldMap
      }
      const newMap = new Map(oldMap)
      newMap.set(key, info)
      return newMap
    })
  })

  return <MaybeMentionContext value={infoMap}>{props.children}</MaybeMentionContext>
}

export const useMaybeMentionInfo = (name: string, channel: string) => {
  const infoMap = React.useContext(MaybeMentionContext)
  const key = getTeamMentionName(name, channel)
  const [localInfo, setLocalInfo] = React.useState<{
    info?: MaybeMentionInfo
    key: string
  }>(() => ({key}))

  useEngineActionListener(
    'chat.1.chatUi.chatMaybeMentionUpdate',
    action => {
      const {teamName, channel: updateChannel, info} = action.payload.params
      const updateKey = getTeamMentionName(teamName, updateChannel)
      if (updateKey === key) {
        setLocalInfo({info, key: updateKey})
      }
    },
    !infoMap
  )

  return infoMap?.get(key) ?? (localInfo.key === key ? localInfo.info : undefined)
}
