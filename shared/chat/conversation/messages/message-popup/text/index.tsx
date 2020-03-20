import * as React from 'react'
import MessagePopupHeader from '../header'
import * as Kb from '../../../../../common-adapters'
import {DeviceType} from '../../../../../constants/types/devices'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import {StylesCrossPlatform} from '../../../../../styles/css'

type Props = {
  attachTo?: () => React.Component<any> | null
  author: string
  botUsername?: string
  deviceName: string
  deviceRevokedAt?: number
  deviceType: DeviceType
  onAddReaction?: () => void
  onCopy?: () => void
  onDelete?: () => void
  onDeleteMessageHistory?: () => void
  onEdit?: () => void
  onHidden: () => void
  onInstallBot?: () => void
  onKick: () => void
  onPinMessage?: () => void
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
    ...(props.isKickable
      ? [
          {
            danger: true,
            disabled: !props.onKick,
            icon: 'iconfont-block-user',
            onClick: props.onKick,
            subTitle: 'Removes the user from the team',
            title: 'Kick user',
          },
        ]
      : []),
    ...((props.yourMessage && (props.isDeleteable || props.isKickable)) || props.onDeleteMessageHistory
      ? (['Divider'] as const)
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
    ...(props.onAddReaction
      ? [{icon: 'iconfont-reacji', onClick: props.onAddReaction, title: 'Add a reaction'}]
      : []),
    ...(props.onCopy ? [{icon: 'iconfont-clipboard', onClick: props.onCopy, title: 'Copy text'}] : []),
    ...(props.onReply ? [{icon: 'iconfont-reply', onClick: props.onReply, title: 'Reply'}] : []),
    ...(props.onReplyPrivately
      ? [{icon: 'iconfont-reply', onClick: props.onReplyPrivately, title: 'Reply privately'}]
      : []),
    ...(props.onPinMessage
      ? [{icon: 'iconfont-pin', onClick: props.onPinMessage, title: 'Pin message'}]
      : []),
    ...(props.onViewProfile
      ? [{icon: 'iconfont-person', onClick: props.onViewProfile, title: 'View profile'}]
      : []),
    ...(!props.yourMessage
      ? [
          {
            danger: true,
            icon: 'iconfont-block-user',
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
    />
  )
}

export default TextPopupMenu
