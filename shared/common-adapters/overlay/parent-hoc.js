// @flow
import * as React from 'react'
import {isMobile} from '../../constants/platform'

export type OverlayParentProps = {
  getAttachmentRef: () => ?React.Component<any>,
  showingMenu: boolean,
  setAttachmentRef: (?React.Component<any>) => void,
  setShowingMenu: boolean => void,
  toggleShowingMenu: () => void,
}

type OverlayParentState = {|
  showingMenu: boolean,
|}

const OverlayParentHOC = <T: OverlayParentProps>(
  ComposedComponent: React.ComponentType<T>
): React.ComponentType<$Diff<T, OverlayParentProps>> => {
  class OverlayParent extends React.Component<$Diff<T, OverlayParentProps>, OverlayParentState> {
    state = {showingMenu: false}
    _ref: ?React.Component<any> = null
    setShowingMenu = (showingMenu: boolean) => this.setState({showingMenu})
    toggleShowingMenu = () => this.setState(oldState => ({showingMenu: !oldState.showingMenu}))
    setAttachmentRef = isMobile
      ? () => {}
      : (attachmentRef: ?React.Component<any>) => {
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
  return OverlayParent
}

export default OverlayParentHOC
