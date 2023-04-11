import * as React from 'react'
import MessagePopupHeader from '../header'
import * as Kb from '../../../../../common-adapters'
import type {DeviceType} from '../../../../../constants/types/devices'
import type {Position, StylesCrossPlatform} from '../../../../../styles'
import ReactionItem from '../reactionitem'

type Props = {
  attachTo?: () => React.Component<any> | null
  author: string
  botUsername?: string
  deviceName: string
  deviceRevokedAt?: number
  deviceType: DeviceType
  onAddReaction?: () => void
  onCopy?: () => void
  onCopyLink?: () => void
  onDelete?: () => void
  onDeleteMessageHistory?: () => void
  onEdit?: () => void
  onForward?: () => void
  onHidden: () => void
  onInstallBot?: () => void
  onKick: () => void
  onPinMessage?: () => void
  onMarkAsUnread: () => void
  onReact: (emoji: string) => void
  onReply?: () => void
  onReplyPrivately?: () => void
  onViewProfile?: () => void
  onViewMap?: () => void
  onUserBlock?: () => void
  isLocation?: boolean
  position: Position
  showDivider: boolean
  style?: StylesCrossPlatform
  timestamp: number
  visible: boolean
  yourMessage: boolean
  isDeleteable: boolean
  isEditable: boolean
  isKickable: boolean
  isTeam: boolean
}

const TextPopupMenu = (props: Props) => {
  const items: Kb.MenuItems = [
    ...(props.showDivider ? (['Divider'] as const) : []),
    ...(props.onAddReaction
      ? [
          {
            unWrapped: true,
            view: (
              <ReactionItem
                onHidden={props.onHidden}
                onReact={props.onReact}
                showPicker={props.onAddReaction}
              />
            ),
          },
          'Divider',
        ]
      : []),
    ...(props.onViewMap
      ? [{icon: 'iconfont-location', onClick: props.onViewMap, title: 'View on Google Maps'}]
      : []),
    ...(props.onEdit && props.isEditable
      ? [
          {
            icon: 'iconfont-edit',
            onClick: props.onEdit,
            title: 'Edit',
          },
        ]
      : []),
    ...(props.onInstallBot
      ? [
          {
            icon: 'iconfont-nav-2-robot',
            onClick: props.onInstallBot,
            title: 'Install bot in another team or chat',
          },
        ]
      : []),
    ...(props.onCopy ? [{icon: 'iconfont-clipboard', onClick: props.onCopy, title: 'Copy text'}] : []),
    ...(props.onCopyLink
      ? [{icon: 'iconfont-link', onClick: props.onCopyLink, title: 'Copy a link to this message'}]
      : []),
    ...(props.onReply ? [{icon: 'iconfont-reply', onClick: props.onReply, title: 'Reply'}] : []),
    ...(props.onForward ? [{icon: 'iconfont-forward', onClick: props.onForward, title: 'Forward'}] : []),
    ...(props.onReplyPrivately
      ? [{icon: 'iconfont-reply', onClick: props.onReplyPrivately, title: 'Reply privately'}]
      : []),
    ...(props.isDeleteable
      ? [
          {
            danger: true,
            disabled: !props.onDelete,
            icon: 'iconfont-trash',
            onClick: props.onDelete,
            subTitle: 'Deletes this message for everyone',
            title: 'Delete',
          },
        ]
      : []),
    ...(props.onPinMessage
      ? [{icon: 'iconfont-pin', onClick: props.onPinMessage, title: 'Pin message'}]
      : []),
    ...[{icon: 'iconfont-envelope-solid', onClick: props.onMarkAsUnread, title: 'Mark as unread'}],
    ...(props.onViewProfile || props.isKickable || !props.yourMessage ? ['Divider' as const] : []),
    ...(props.onViewProfile
      ? [{icon: 'iconfont-person', onClick: props.onViewProfile, title: 'View profile'}]
      : []),
    ...(props.isKickable
      ? [
          {
            danger: true,
            disabled: !props.onKick,
            icon: 'iconfont-user-block',
            onClick: props.onKick,
            subTitle: 'Removes the user from the team',
            title: 'Kick user',
          },
        ]
      : []),
    ...(!props.yourMessage
      ? [
          {
            danger: true,
            icon: 'iconfont-user-block',
            onClick: props.onUserBlock,
            title: props.isTeam ? 'Report user' : 'Block user',
          },
        ]
      : []),
  ].reduce<Kb.MenuItems>((arr, i) => {
    i && arr.push(i as Kb.MenuItem)
    return arr
  }, [])

  const header = (
    <MessagePopupHeader
      author={props.author}
      botUsername={props.botUsername}
      deviceName={props.deviceName}
      deviceRevokedAt={props.deviceRevokedAt}
      deviceType={props.deviceType}
      isLast={!items.length}
      isLocation={!!props.isLocation}
      timestamp={props.timestamp}
      yourMessage={props.yourMessage}
    />
  )

  return (
    <Kb.FloatingMenu
      attachTo={props.attachTo}
      closeOnSelect={true}
      header={header}
      items={items}
      onHidden={props.onHidden}
      position={props.position}
      positionFallbacks={[]}
      containerStyle={props.style}
      visible={props.visible}
      safeProviderStyle={safeProviderStyle}
    />
  )
}

const safeProviderStyle = {flex: 1} as const

export default TextPopupMenu
