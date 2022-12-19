import * as React from 'react'
import type * as Kb from '../../common-adapters'
import * as Container from '../../util/container'
import type {IconStyle} from '../../common-adapters/icon'
import {anyVersionsUnseen} from '../../constants/whats-new'
import IconComponent, {IconWithPopup as IconWithPopupComponent} from './index'

type OwnProps = {
  color?: string
  badgeColor?: string
  style?: IconStyle
}

type PopupOwnProps = OwnProps & {
  attachToRef: React.RefObject<Kb.Box2>
}

// Just Whats New Icon connected for badge state
const IconContainer = (p: OwnProps) => {
  const {badgeColor, style, color} = p
  const newRelease = Container.useSelector(state => anyVersionsUnseen(state.config.whatsNewLastSeenVersion))
  return <IconComponent badgeColor={badgeColor} color={color} newRelease={newRelease} style={style} />
}

// Whats New icon with popup which is connected to the badge state and marking release as seen.
export const IconWithPopup = (p: PopupOwnProps) => {
  const {attachToRef, badgeColor, style, color} = p
  const newRelease = Container.useSelector(state => anyVersionsUnseen(state.config.whatsNewLastSeenVersion))
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
