import * as C from '../../../../../constants'
import * as Constants from '../../../../../constants/chat2'
import Text from '.'
import openURL from '../../../../../util/open-url'
import * as React from 'react'
import type * as T from '../../../../../constants/types'
import type {Position, StylesCrossPlatform} from '../../../../../styles'
import {makeMessageText} from '../../../../../constants/chat2/message'
import {useData} from '../hooks'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  ordinal: T.Chat.Ordinal
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const emptyMessage = makeMessageText({})

export default (ownProps: OwnProps) => {
  const {ordinal, attachTo, onHidden, position, style, visible} = ownProps
  const d = useData(ordinal, false)
  const {yourMessage, teamID, onCopyLink, deviceType, onReply, onReact, isTeam, onPinMessage} = d
  const {onMarkAsUnread, onKick, onInstallBot, onForward: _onForward, onEdit, onDelete, onAddReaction} = d
  const {deviceRevokedAt, deviceName, author, botUsername, timestamp} = d
  const m = C.useChatContext(s => s.messageMap.get(ordinal))
  const message = m?.type === 'text' ? m : emptyMessage
  const {text, conversationIDKey} = message
  const meta = C.useChatContext(s => s.meta)
  const participantInfo = C.useChatContext(s => s.participants)
  const yourOperations = C.useTeamsState(s => C.getCanPerformByID(s, teamID))
  // you can reply privately *if* text message, someone else's message, and not in a 1-on-1 chat
  const canReplyPrivately = ['small', 'big'].includes(meta.teamType) || participantInfo.all.length > 2
  const isEditable = message.isEditable && yourMessage
  const _participants = participantInfo.all
  const _teamname = meta.teamname
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const onCopy = React.useCallback(() => {
    copyToClipboard(text.stringValue())
  }, [copyToClipboard, text])

  const canDeleteHistory = yourOperations.deleteChatHistory
  const _onDeleteMessageHistory = React.useCallback(() => {
    C.getConvoState(conversationIDKey).dispatch.navigateToThread('misc')
    navigateAppend({
      props: {conversationIDKey},
      selected: 'chatDeleteHistoryWarning',
    })
  }, [navigateAppend, conversationIDKey])
  const onDeleteMessageHistory = canDeleteHistory ? _onDeleteMessageHistory : undefined

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
  const isLocation = !!mapUnfurl
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

  const onForward = message.unfurls.size > 0 ? _onForward : undefined // only unfurls?
  const showDivider = !deviceRevokedAt

  const props = {
    attachTo,
    author,
    botUsername,
    deviceName,
    deviceRevokedAt,
    deviceType,
    isEditable,
    isLocation,
    isTeam,
    onAddReaction,
    onCopy,
    onCopyLink,
    onDelete,
    onDeleteMessageHistory,
    onEdit,
    onForward,
    onHidden,
    onInstallBot,
    onKick,
    onMarkAsUnread,
    onPinMessage,
    onReact,
    onReply,
    onReplyPrivately,
    onUserBlock,
    onUserFilter,
    onUserFlag,
    onUserReport,
    onViewMap,
    onViewProfile,
    position,
    showDivider,
    style,
    timestamp,
    visible,
    yourMessage,
  }
  return <Text {...props} />
}
