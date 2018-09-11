// @flow
import * as React from 'react'
import {isMobile} from '../constants/platform'

export type OverlayParentProps = {
  attachmentRef: ?React.Component<any, any>,
  showingMenu: boolean,
  setAttachmentRef: ?(?React.Component<any, any>) => void,
  setShowingMenu: boolean => void,
  toggleShowingMenu: () => void,
}

type OverlayParentState = {|
  attachmentRef: ?React.Component<any, any>,
  showingMenu: boolean,
|}

const OverlayParentHOC = <T: OverlayParentProps>(
  ComposedComponent: React.ComponentType<T>
): React.ComponentType<$Diff<T, OverlayParentProps>> => {
  class OverlayParent extends React.Component<$Diff<T, OverlayParentProps>, OverlayParentState> {
    state = {attachmentRef: null, showingMenu: false}
    setShowingMenu = (showingMenu: boolean) => this.setState({showingMenu})
    toggleShowingMenu = () => this.setState(oldState => ({showingMenu: !oldState.showingMenu}))
    setAttachmentRef = isMobile
      ? undefined
      : (attachmentRef: ?React.Component<any, any>) => this.setState({attachmentRef})

    render() {
      return (
        <ComposedComponent
          {...this.props}
          setShowingMenu={this.setShowingMenu}
          toggleShowingMenu={this.toggleShowingMenu}
          setAttachmentRef={this.setAttachmentRef}
          {...this.state}
        />
      )
    }
  }
  return OverlayParent
}

export default OverlayParentHOC
