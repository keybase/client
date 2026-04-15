import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type * as React from 'react'
import type {Position, StylesCrossPlatform} from '@/styles'

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  mode?: 'modal' | 'bottomsheet'
  onHidden: () => void
  ordinal: T.Chat.Ordinal
  position: Position
  style?: StylesCrossPlatform
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

  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={items}
      mode={mode}
      onHidden={onHidden}
      position={position}
      containerStyle={style}
      visible={visible}
      safeProviderStyle={safeProviderStyle}
    />
  )
}
const safeProviderStyle = {flex: 1} as const
export default JourneyCard
