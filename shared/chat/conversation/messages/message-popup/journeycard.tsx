import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type * as React from 'react'
import type {Position, StylesCrossPlatform} from '@/styles'

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null> | undefined
  mode?: 'modal' | 'bottomsheet' | undefined
  onHidden: () => void
  ordinal: T.Chat.Ordinal
  position: Position
  style?: StylesCrossPlatform | undefined
  visible: boolean
}

const JourneyCard = (ownProps: OwnProps) => {
  const {ordinal, attachTo, mode, onHidden, style, visible, position} = ownProps
  const cardType = ConvoState.useChatContext(
    s => s.messageMap.get(ordinal)?.cardType ?? T.RPCChat.JourneycardType.unused
  )

  const dismissJourneycard = ConvoState.useChatContext(s => s.dispatch.dismissJourneycard)
  const onDismiss = () => {
    dismissJourneycard(cardType, ordinal)
  }

  const items: Kb.MenuItems = [{icon: 'iconfont-close', onClick: onDismiss, title: 'Dismiss message'}]
  const floatingMenuProps = {
    ...(attachTo ? {attachTo} : {}),
    ...(mode ? {mode} : {}),
    ...(style ? {containerStyle: style} : {}),
  }

  return (
    <Kb.FloatingMenu
      {...floatingMenuProps}
      closeOnSelect={true}
      items={items}
      onHidden={onHidden}
      position={position}
      visible={visible}
      safeProviderStyle={safeProviderStyle}
    />
  )
}
const safeProviderStyle = {flex: 1} as const
export default JourneyCard
