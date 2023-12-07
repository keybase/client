import type * as React from 'react'
import type * as T from '@/constants/types'
import type * as Kb from '@/common-adapters'

export type Props = {
  attachTo?: React.RefObject<Kb.MeasureRef>
  visible: boolean
  onHidden: () => void
  selected: number
  onSelect: (arg0: number) => void
  items: T.Chat.MessageExplodeDescription[]
}
export declare const SetExplodingPopup: (p: Props) => React.ReactNode
export default SetExplodingPopup
