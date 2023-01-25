import * as Constants from '../../../../../../constants/chat2'
import * as Container from '../../../../../../util/container'
import * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Styles from '../../../../../../styles'
import UnfurlGeneric from './generic'
import UnfurlGiphy from './giphy'
import UnfurlMap from './map'
import type * as Types from '../../../../../../constants/types/chat2'
import * as Kb from '../../../../../../common-adapters'
import {ConvoIDContext, OrdinalContext} from '../../../ids-context'
import shallowEqual from 'shallowequal'

export type UnfurlListItem = {
  unfurl: RPCChatTypes.UnfurlDisplay
  url: string
  isCollapsed: boolean
  onClose?: () => void
  onCollapse: () => void
}

export type ListProps = {
  conversationIDKey: Types.ConversationIDKey
  isAuthor: boolean
  author?: string
  toggleMessagePopup: () => void
  unfurls: Array<UnfurlListItem>
}

export type UnfurlProps = {
  conversationIDKey: Types.ConversationIDKey
  isAuthor: boolean
  author?: string
  isCollapsed: boolean
  onClose?: () => void
  onCollapse: () => void
  toggleMessagePopup: () => void
  unfurl: RPCChatTypes.UnfurlDisplay
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          flex: 1,
          marginBottom: Styles.globalMargins.xtiny,
          marginTop: Styles.globalMargins.xtiny,
        },
      }),
    } as const)
)

type UnfurlRenderType = 'generic' | 'map' | 'giphy'

const renderTypeToClass = new Map<UnfurlRenderType, React.ExoticComponent<{idx: number}>>([
  ['generic', UnfurlGeneric],
  ['map', UnfurlMap],
  ['giphy', UnfurlGiphy],
])

const UnfurlListContainer = React.memo(function UnfurlListContainer() {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const unfurlTypes: Array<UnfurlRenderType | 'none'> = Container.useSelector(
    state =>
      [...(Constants.getMessage(state, conversationIDKey, ordinal)?.unfurls?.values() ?? [])].map(u => {
        const ut = u.unfurl.unfurlType
        switch (ut) {
          case RPCChatTypes.UnfurlType.giphy:
            return 'giphy'
          case RPCChatTypes.UnfurlType.generic:
            return u.unfurl.generic.mapInfo ? 'map' : 'generic'
          default:
            return 'none'
        }
      }),
    shallowEqual
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
