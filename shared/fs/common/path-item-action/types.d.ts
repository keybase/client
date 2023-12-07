import type * as React from 'react'
import type * as Kb from '@/common-adapters'

export type FloatingMenuProps = {
  containerStyle?: Kb.Styles.StylesCrossPlatform
  hide: () => void
  visible: boolean
  attachTo?: React.RefObject<Kb.MeasureRef>
}
