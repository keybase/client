import * as C from '../../../../constants'
import * as Constants from '../../../../constants/chat2'
import openURL from '../../../../util/open-url'
import * as React from 'react'
import type * as T from '../../../../constants/types'
import type {Position, StylesCrossPlatform} from '../../../../styles'
import {makeMessageText} from '../../../../constants/chat2/message'
import {useItems, useHeader} from './hooks'
import * as Kb from '../../../../common-adapters'

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef>
  ordinal: T.Chat.Ordinal
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = makeMessageText({})

export default (ownProps: OwnProps) => {
  const {ordinal, attachTo, onHidden, position, style, visible} = ownProps
  const m = C.useChatContext(s => s.messageMap.get(ordinal))
  const you = C.useCurrentUserState(s => s.username)
  const message = m?.type === 'text' ? m : emptyMessage
  const {text, conversationIDKey, author} = message
  const yourMessage = author === you
  const meta = C.useChatContext(s => s.meta)
  const {teamname} = meta
  const isTeam = !!teamname
  const participantInfo = C.useChatContext(s => s.participants)
  // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
  const canReplyPrivately = ['small', 'big'].includes(meta.teamType) || participantInfo.all.length > 2
  const _participants = participantInfo.all
  const _teamname = meta.teamname
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const onCopy = React.useCallback(() => {
    copyToClipboard(text.stringValue())
  }, [copyToClipboard, text])

  const _showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  const showUserProfile = React.useCallback(() => {
    _showUserProfile(author)
  }, [_showUserProfile, author])
  const onViewProfile = author && !yourMessage ? showUserProfile : undefined
  const messageReplyPrivately = C.useChatContext(s => s.dispatch.messageReplyPrivately)
  const _onReplyPrivately = React.useCallback(() => {
    messageReplyPrivately(ordinal)
  }, [messageReplyPrivately, ordinal])
  const onReplyPrivately = !yourMessage && canReplyPrivately ? _onReplyPrivately : undefined
  const mapUnfurl = Constants.getMapUnfurl(message)
  // don't pass onViewMap if we don't have a coordinate (e.g. when a location share ends)
  const onViewMap =
    mapUnfurl?.mapInfo && !mapUnfurl.mapInfo.isLiveLocationDone ? () => openURL(mapUnfurl.url) : undefined
  const blockModalSingle = !_teamname && _participants.length === 2

  const _onUserReport = React.useCallback(() => {
    navigateAppend({
      props: {
        blockUserByDefault: true,
        context: blockModalSingle ? 'message-popup-single' : 'message-popup',
        conversationIDKey,
        reportsUserByDefault: true,
        username: author,
      },
      selected: 'chatBlockingModal',
    })
  }, [conversationIDKey, blockModalSingle, navigateAppend, author])
  const onUserReport = C.isIOS && author && !yourMessage ? () => _onUserReport : undefined

  const _onUserFlag = React.useCallback(() => {
    navigateAppend({
      props: {
        blockUserByDefault: true,
        context: blockModalSingle ? 'message-popup-single' : 'message-popup',
        conversationIDKey,
        flagUserByDefault: true,
        reportsUserByDefault: true,
        username: author,
      },
      selected: 'chatBlockingModal',
    })
  }, [conversationIDKey, blockModalSingle, navigateAppend, author])
  const onUserFlag = C.isIOS && author && !yourMessage ? _onUserFlag : undefined

  const _onUserBlock = React.useCallback(() => {
    navigateAppend({
      props: {
        blockUserByDefault: true,
        context: blockModalSingle ? 'message-popup-single' : 'message-popup',
        conversationIDKey,
        username: author,
      },
      selected: 'chatBlockingModal',
    })
  }, [conversationIDKey, blockModalSingle, navigateAppend, author])
  const onUserBlock = author && !yourMessage ? () => _onUserBlock : undefined

  const _onUserFilter = React.useCallback(() => {
    navigateAppend({
      props: {
        blockUserByDefault: true,
        context: blockModalSingle ? 'message-popup-single' : 'message-popup',
        conversationIDKey,
        filterUserByDefault: true,
        username: author,
      },
      selected: 'chatBlockingModal',
    })
  }, [conversationIDKey, blockModalSingle, navigateAppend, author])
  const onUserFilter = C.isIOS && author && !yourMessage ? () => _onUserFilter : undefined

  const i = useItems(ordinal, false, onHidden)
  const {itemReaction, itemBot, itemCopyLink, itemReply, itemEdit, itemForward, itemPin, itemUnread} = i
  const {itemDelete, itemExplode, itemKick} = i

  const itemMap = onViewMap
    ? ([{icon: 'iconfont-location', onClick: onViewMap, title: 'View on Google Maps'}] as const)
    : []
  const itemCopyText = [{icon: 'iconfont-clipboard', onClick: onCopy, title: 'Copy text'}] as const
  const itemReplyPrivately = onReplyPrivately
    ? ([{icon: 'iconfont-reply', onClick: onReplyPrivately, title: 'Reply privately'}] as const)
    : []
  const itemDivider = onViewProfile || itemKick.length || !yourMessage ? (['Divider'] as const) : []
  const itemProfile = onViewProfile
    ? ([{icon: 'iconfont-person', onClick: onViewProfile, title: 'View profile'}] as const)
    : []

  const itemBlock = !yourMessage
    ? ([
        {
          danger: true,
          icon: 'iconfont-user-block',
          onClick: onUserBlock,
          title: isTeam ? 'Report user' : 'Block user',
        },
      ] as const)
    : []
  const itemFilter =
    !yourMessage && onUserFilter
      ? ([
          {
            danger: true,
            icon: 'iconfont-user-block',
            onClick: onUserFilter,
            title: 'Filter user',
          },
        ] as const)
      : []
  const itemReport =
    !yourMessage && !isTeam && onUserReport
      ? ([
          {
            danger: true,
            icon: 'iconfont-user-block',
            onClick: onUserReport,
            title: 'Report user',
          },
        ] as const)
      : []
  const itemFlag =
    !yourMessage && onUserFlag
      ? ([
          {
            danger: true,
            icon: 'iconfont-user-block',
            onClick: onUserFlag,
            title: 'Flag content',
          },
        ] as const)
      : []

  const items = [
    ...itemReaction,
    ...itemMap,
    ...itemEdit,
    ...itemBot,
    ...itemCopyText,
    ...itemCopyLink,
    ...itemReply,
    ...itemForward,
    ...itemReplyPrivately,
    ...itemDelete,
    ...itemExplode,
    ...itemPin,
    ...itemUnread,
    ...itemDivider,
    ...itemProfile,
    ...itemKick,
    ...itemBlock,
    ...itemFilter,
    ...itemReport,
    ...itemFlag,
  ]
  const header = useHeader(ordinal, false)

  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      header={header}
      items={items}
      onHidden={onHidden}
      position={position}
      containerStyle={style}
      visible={visible}
      safeProviderStyle={safeProviderStyle}
    />
  )
}

const safeProviderStyle = {flex: 1} as const
