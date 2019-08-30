import * as React from 'react'
import {isMobile, hoistNonReactStatic} from '../../util/container'

export type OverlayParentProps = {
  getAttachmentRef?: () => React.Component<any> | null
  showingMenu: boolean
  setAttachmentRef: (arg0: React.Component<any> | null) => void
  setShowingMenu: (arg0: boolean) => void
  toggleShowingMenu: () => void
}

export type PropsWithOverlay<Props> = Props & OverlayParentProps
export type PropsWithoutOverlay<Props> = Exclude<Props, OverlayParentProps>

type OverlayParentState = {
  showingMenu: boolean
}

const OverlayParentHOC = <Props extends {}>(
  ComposedComponent: React.ComponentType<PropsWithOverlay<Props>>
): React.ComponentType<PropsWithoutOverlay<Props>> => {
  class _OverlayParent extends React.Component<PropsWithoutOverlay<Props>, OverlayParentState> {
    state = {showingMenu: false}
    _ref: React.Component<any> | null = null
    setShowingMenu = (showingMenu: boolean) =>
      this.setState(oldState => (oldState.showingMenu === showingMenu ? null : {showingMenu}))
    toggleShowingMenu = () => this.setState(oldState => ({showingMenu: !oldState.showingMenu}))
    setAttachmentRef = isMobile
      ? () => {}
      : (attachmentRef: React.Component<any> | null) => {
          this._ref = attachmentRef
        }
    getAttachmentRef = () => this._ref

    render() {
      return (
        <ComposedComponent
          {...this.props}
          setShowingMenu={this.setShowingMenu}
          toggleShowingMenu={this.toggleShowingMenu}
          setAttachmentRef={this.setAttachmentRef}
          getAttachmentRef={this.getAttachmentRef}
          showingMenu={this.state.showingMenu}
        />
      )
    }
  }
  const OverlayParent: React.ComponentClass<PropsWithoutOverlay<Props>, OverlayParentState> = _OverlayParent
  OverlayParent.displayName = ComposedComponent.displayName || 'OverlayParent'
  hoistNonReactStatic(OverlayParent, ComposedComponent)
  return OverlayParent
}

export default OverlayParentHOC
