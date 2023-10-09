import * as React from 'react'
import * as Kb from '../../../common-adapters'

export type FloatingMenuProps = {
  containerStyle?: Kb.Styles.StylesCrossPlatform
  hide: () => void
  visible: boolean
  attachTo?: React.RefObject<Kb.MeasureRef>
}
