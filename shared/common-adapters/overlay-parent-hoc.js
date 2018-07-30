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

type OverlayParentCallbacks = {|
  setShowingMenu: boolean => void,
  toggleShowingMenu: () => void,
  // WARNING: Only use setAttachmentRef on class components. Otherwise the ref will be
  // optimized out in production code!
  setAttachmentRef: ?(?React.Component<any, any>) => void,
|}

const OverlayParentHOC = <T: OverlayParentProps>(
  ComposedComponent: React.ComponentType<T>
): React.ComponentType<$Diff<T, OverlayParentProps>> => {
  class OverlayParent extends React.Component<$Diff<T, OverlayParentProps>, OverlayParentState> {
    _setters: OverlayParentCallbacks
    state = {attachmentRef: null, showingMenu: false}
    constructor(props: $Diff<T, OverlayParentProps>) {
      super(props)
      this._setters = {
        setShowingMenu: showingMenu =>
          this.setState({
            showingMenu,
          }),
        toggleShowingMenu: () =>
          this.setState(oldState => ({
            showingMenu: !oldState.showingMenu,
          })),
        setAttachmentRef: isMobile ? undefined : attachmentRef => this.setState({attachmentRef}),
      }
    }
    render() {
      return <ComposedComponent {...this.props} {...this._setters} {...this.state} />
    }
  }
  return OverlayParent
}

export default OverlayParentHOC
