import type * as React from 'react'
import type * as Kb from '@/common-adapters'

export type Props = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  onAfterSelect?: (s: number) => void
  onHidden: () => void
  visible: boolean
  setExplodingMode: (mode: number) => void
}

export declare const SetExplodingPopup: (p: Props) => React.ReactNode
export default SetExplodingPopup
