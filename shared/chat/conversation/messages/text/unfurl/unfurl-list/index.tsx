import * as T from '@/constants/types'
import type * as React from 'react'
import UnfurlGeneric from './generic'
import UnfurlGiphy from './giphy'
import UnfurlMap from './map'
import * as Kb from '@/common-adapters'
import {useOrdinal} from '@/chat/conversation/messages/ids-context'
import {useCurrentUserState} from '@/stores/current-user'

type UnfurlItemProps = {
  author: string
  conversationIDKey: T.Chat.ConversationIDKey
  ordinal: T.Chat.Ordinal
  unfurlInfo: T.RPCChat.UIMessageUnfurlInfo
  youAreAuthor: boolean
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

const renderTypeToClass = new Map<UnfurlRenderType, React.ComponentType<UnfurlItemProps>>([
  ['generic', UnfurlGeneric],
  ['map', UnfurlMap],
  ['giphy', UnfurlGiphy],
])

function UnfurlListContainer({
  author,
  conversationIDKey,
  unfurls,
}: {
  author: string
  conversationIDKey: T.Chat.ConversationIDKey
  unfurls?: T.Chat.UnfurlMap | undefined
}) {
  const ordinal = useOrdinal()
  const you = useCurrentUserState(s => s.username)
  const youAreAuthor = author === you
  const items = [...(unfurls?.values() ?? [])]
  return (
    <Kb.Box2 direction="vertical" gap="tiny" style={styles.container}>
      {items.map((unfurlInfo, idx) => {
        const ut = unfurlInfo.unfurl.unfurlType
        let renderType: UnfurlRenderType | 'none'
        switch (ut) {
          case T.RPCChat.UnfurlType.giphy:
            renderType = 'giphy'
            break
          case T.RPCChat.UnfurlType.generic:
            renderType = unfurlInfo.unfurl.generic.mapInfo ? 'map' : 'generic'
            break
          default:
            renderType = 'none'
        }
        const Clazz = renderType === 'none' ? null : renderTypeToClass.get(renderType)
        return Clazz ? (
          <Clazz
            author={author}
            conversationIDKey={conversationIDKey}
            key={String(idx)}
            ordinal={ordinal}
            unfurlInfo={unfurlInfo}
            youAreAuthor={youAreAuthor}
          />
        ) : null
      })}
    </Kb.Box2>
  )
}
export default UnfurlListContainer
