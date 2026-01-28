import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as T from '@/constants/types'
import * as React from 'react'
import UnfurlGeneric from './generic'
import UnfurlGiphy from './giphy'
import UnfurlMap from './map'
import * as Kb from '@/common-adapters'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'

export type UnfurlListItem = {
  unfurl: T.RPCChat.UnfurlDisplay
  url: string
  isCollapsed: boolean
  onClose?: () => void
  onCollapse: () => void
}

export type ListProps = {
  isAuthor: boolean
  author?: string
  toggleMessagePopup: () => void
  unfurls: Array<UnfurlListItem>
}

export type UnfurlProps = {
  isAuthor: boolean
  author?: string
  isCollapsed: boolean
  onClose?: () => void
  onCollapse: () => void
  toggleMessagePopup: () => void
  unfurl: T.RPCChat.UnfurlDisplay
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          flex: 1,
          marginBottom: Kb.Styles.globalMargins.xtiny,
          marginTop: Kb.Styles.globalMargins.xtiny,
        },
      }),
    }) as const
)

type UnfurlRenderType = 'generic' | 'map' | 'giphy'

const renderTypeToClass = new Map<UnfurlRenderType, React.ExoticComponent<{idx: number}>>([
  ['generic', UnfurlGeneric],
  ['map', UnfurlMap],
  ['giphy', UnfurlGiphy],
])

const UnfurlListContainer = React.memo(function UnfurlListContainer() {
  const ordinal = useOrdinal()
  const unfurlTypes: Array<UnfurlRenderType | 'none'> = Chat.useChatContext(
    C.useShallow(s =>
      [...(s.messageMap.get(ordinal)?.unfurls?.values() ?? [])].map(u => {
        const ut = u.unfurl.unfurlType
        switch (ut) {
          case T.RPCChat.UnfurlType.giphy:
            return 'giphy'
          case T.RPCChat.UnfurlType.generic:
            return u.unfurl.generic.mapInfo ? 'map' : 'generic'
          default:
            return 'none'
        }
      })
    )
  )
  return (
    <Kb.Box2 direction="vertical" gap="tiny" style={styles.container}>
      {unfurlTypes.map((ut, idx) => {
        const Clazz = ut === 'none' ? null : renderTypeToClass.get(ut)
        return Clazz ? <Clazz key={String(idx)} idx={idx} /> : null
      })}
    </Kb.Box2>
  )
})
export default UnfurlListContainer
