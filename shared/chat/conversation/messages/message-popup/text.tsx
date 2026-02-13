import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import {useConfigState} from '@/stores/config'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type {Position, StylesCrossPlatform} from '@/styles'
import {useItems, useHeader} from './hooks'
import openURL from '@/util/open-url'
import {useCurrentUserState} from '@/stores/current-user'

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  ordinal: T.Chat.Ordinal
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = Chat.makeMessageText({})

const PopText = (ownProps: OwnProps) => {
  const {ordinal, attachTo, onHidden, position, style, visible} = ownProps
  const message = Chat.useChatContext(s => {
    const m = s.messageMap.get(ordinal)
    const message = m ?? emptyMessage
    return message
  })
  const you = useCurrentUserState(s => s.username)
  const {conversationIDKey, author} = message
  const text = React.useMemo(() => {
    switch (message.type) {
      case 'text':
        return message.text.stringValue()
      case 'systemGitPush':
        switch (message.pushType) {
          case T.RPCGen.GitPushType.createrepo:
            return `created a new team repository called ${message.repo}`
          case T.RPCGen.GitPushType.default:
            return message.refs
              ?.map(ref => {
                const commits =
                  ref.commits?.map(
                    c =>
                      `• ${c.commitHash.substring(0, 8)} - ${c.message.endsWith('\n') ? c.message.substring(0, c.message.length - 1) : c.message}`
                  ) ?? []

                const branchName = Chat.systemGitBranchName(ref)
                const parts = [
                  `pushed ${ref.commits?.length ?? 0} commit${(ref.commits?.length ?? 0) > 1 ? 's' : ''} to ${message.repo}/${branchName}`,
                  ...commits,
                ]
                return parts.join('\n')
              })
              .join('\n')
          default:
            return undefined
        }
      default:
        return undefined
    }
  }, [message])

  const yourMessage = author === you
  const {isTeam, messageReplyPrivately, numPart, teamType} = Chat.useChatContext(
    C.useShallow(s => {
      const {teamType, teamname} = s.meta
      const isTeam = !!teamname
      const numPart = s.participants.all.length
      const {messageReplyPrivately} = s.dispatch
      return {isTeam, messageReplyPrivately, numPart, teamType}
    })
  )
  // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
  const canReplyPrivately = ['small', 'big'].includes(teamType) || numPart > 2
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const copyToClipboard = useConfigState(s => s.dispatch.defer.copyToClipboard)
  const onCopy = React.useCallback(() => {
    text && copyToClipboard(text)
  }, [copyToClipboard, text])

  const _onReplyPrivately = React.useCallback(() => {
    messageReplyPrivately(ordinal)
  }, [messageReplyPrivately, ordinal])
  const onReplyPrivately = !yourMessage && canReplyPrivately ? _onReplyPrivately : undefined
  const mapUnfurl = Chat.getMapUnfurl(message)
  // don't pass onViewMap if we don't have a coordinate (e.g. when a location share ends)
  const onViewMap =
    mapUnfurl?.mapInfo && !mapUnfurl.mapInfo.isLiveLocationDone ? () => openURL(mapUnfurl.url) : undefined
  const blockModalSingle = !isTeam && numPart === 2

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
  const onUserBlock = author && !yourMessage ? _onUserBlock : undefined

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

  const i = useItems(ordinal, onHidden)
  const {itemReaction, itemBot, itemCopyLink, itemReply, itemEdit, itemForward, itemPin, itemUnread} = i
  const {itemDelete, itemExplode, itemKick, itemProfile} = i

  const itemMap = onViewMap
    ? ([{icon: 'iconfont-location', onClick: onViewMap, title: 'View on Google Maps'}] as const)
    : []
  const itemCopyText = text
    ? ([{icon: 'iconfont-clipboard', onClick: onCopy, title: 'Copy text'}] as const)
    : []
  const itemReplyPrivately = onReplyPrivately
    ? ([{icon: 'iconfont-reply', onClick: onReplyPrivately, title: 'Reply privately'}] as const)
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
    ...itemEdit,
    ...itemExplode,
    ...itemCopyText,
    ...itemReply,
    ...itemUnread,
    'Divider' as const,
    ...itemDelete,
    ...itemForward,
    ...itemCopyLink,
    ...itemReplyPrivately,
    ...itemPin,
    ...itemBot,
    ...itemMap,
    ...itemProfile,
    ...itemKick,
    ...itemBlock,
    ...itemFilter,
    ...itemReport,
    ...itemFlag,
  ]
  const header = useHeader(ordinal, onHidden)
  const snapPoints = React.useMemo(() => [8 * 40 + 25], [])

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
      snapPoints={snapPoints}
      safeProviderStyle={safeProviderStyle}
    />
  )
}

const safeProviderStyle = {flex: 1} as const
export default PopText
