import {AnchoredPopup} from './anchored'
import {ModalCover} from './modal-cover'
import {Sheet} from './sheet'
import type {PopupProps} from './index.shared'
export type {PopupProps} from './index.shared'

// The one place the platform rule lives: on mobile every popup presents as a
// bottom sheet. Callers that need a mode regardless of platform - an overlay
// pinned to an input, a desktop-only cover - render that mode directly instead.
function Popup(props: PopupProps) {
  if (isMobile) {
    return (
      <Sheet footer={props.footer} onHidden={props.onHidden} snapPoints={props.snapPoints} style={props.style}>
        {props.children}
      </Sheet>
    )
  }

  if (props.intent === 'menu' && props.attachTo) {
    return (
      <AnchoredPopup
        attachTo={props.attachTo}
        containerStyle={props.containerStyle}
        matchDimension={props.matchDimension}
        offset={props.offset}
        onHidden={props.onHidden}
        position={props.position}
        positionFallbacks={props.positionFallbacks}
        propagateOutsideClicks={props.propagateOutsideClicks}
        remeasureHint={props.remeasureHint}
        style={props.style}
      >
        {props.children}
      </AnchoredPopup>
    )
  }

  // a menu with nothing to anchor to falls back to the cover: the positioner
  // can't measure a target and would render an invisible box
  return (
    <ModalCover onHidden={props.onHidden} style={props.style}>
      {props.children}
    </ModalCover>
  )
}

export default Popup
