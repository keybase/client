import * as C from '@/constants'
import * as React from 'react'
import IconComponent, {IconWithPopup as IconWithPopupComponent} from '.'
import type * as Kb from '@/common-adapters'
import type {IconStyle} from '@/common-adapters/icon'

type OwnProps = {
  color?: string
  badgeColor?: string
  style?: IconStyle
}

type PopupOwnProps = OwnProps & {
  attachToRef: React.RefObject<Kb.MeasureRef>
}

// Just Whats New Icon connected for badge state
const IconContainer = (p: OwnProps) => {
  const {badgeColor, style, color} = p
  const newRelease = C.useWNState(s => s.anyVersionsUnseen())
  return <IconComponent badgeColor={badgeColor} color={color} newRelease={newRelease} style={style} />
}

// Whats New icon with popup which is connected to the badge state and marking release as seen.
export const IconWithPopupDesktop = (p: PopupOwnProps) => {
  const {attachToRef, badgeColor, style, color} = p
  const newRelease = C.useWNState(s => s.anyVersionsUnseen())
  return (
    <IconWithPopupComponent
      attachToRef={attachToRef}
      badgeColor={badgeColor}
      color={color}
      newRelease={newRelease}
      style={style}
    />
  )
}

export default IconContainer
