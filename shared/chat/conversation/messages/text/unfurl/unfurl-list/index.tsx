// import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import * as Constants from '../../../../../../constants/chat2'
import * as Container from '../../../../../../util/container'
import type * as RPCChatTypes from '../../../../../../constants/types/rpc-chat-gen'
import * as React from 'react'
import * as Styles from '../../../../../../styles'
import UnfurlGeneric from './generic'
import UnfurlGiphy from './giphy/container'
import UnfurlMap from './map'
import UnfurlSharingEnded from './map/ended'
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

type OwnProps = {
  toggleMessagePopup: () => void
}

type UnfurlRenderType = 'generic' | 'map' | 'mapdone' | 'giphy'

const renderTypeToClass = new Map<UnfurlRenderType, any /*TODOlReact.ExoticComponent<{idx: number}>*/>([
  ['generic', UnfurlGeneric],
  ['map', UnfurlMap],
  ['mapdone', UnfurlSharingEnded],
  ['giphy', UnfurlGiphy],
])

const UnfurlListContainer = React.memo(function UnfurlListContainer(_p: OwnProps) {
  // const {toggleMessagePopup} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const unfurlTypes: Array<UnfurlRenderType> = Container.useSelector(
    state =>
      [...(Constants.getMessage(state, conversationIDKey, ordinal)?.unfurls?.values() ?? [])].map(u => {
        const ut = u.unfurl.unfurlType
        switch (ut) {
          default:
            return 'generic'
        }
      }),
    shallowEqual
  )
  // const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  // const you = Container.useSelector(state => state.config.username)
  // const _unfurls = message && message.type === 'text' ? message.unfurls : null
  // const author = message ? message.author : undefined
  // const isAuthor = message ? you === message.author : false
  // const dispatch = Container.useDispatch()
  // const onClose = (messageID: Types.MessageID) => {
  //   dispatch(Chat2Gen.createUnfurlRemove({conversationIDKey, messageID}))
  // }
  // const onCollapse = (messageID: Types.MessageID) => {
  //   dispatch(Chat2Gen.createToggleMessageCollapse({conversationIDKey, messageID}))
  // }
  // const unfurls = _unfurls
  //   ? [..._unfurls.values()].map(u => {
  //       return {
  //         isCollapsed: u.isCollapsed,
  //         onClose: isAuthor ? () => onClose(Types.numberToMessageID(u.unfurlMessageID)) : undefined,
  //         onCollapse: () => onCollapse(Types.numberToMessageID(u.unfurlMessageID)),
  //         unfurl: u.unfurl,
  //         url: u.url,
  //       }
  //     })
  //   : []
  return (
    <Kb.Box2 direction="vertical" gap="tiny" style={styles.container}>
      {unfurlTypes.map((ut, idx) => {
        const Clazz = renderTypeToClass.get(ut)
        return Clazz ? <Clazz key={String(idx)} idx={idx} /> : null
      })}
    </Kb.Box2>
  )
})
export default UnfurlListContainer
