// @flow
import * as React from 'react'
import {isMobile} from '../../constants/platform'

export type FloatingMenuParentProps = {
  attachmentRef: ?React.Component<any, any>,
  showingMenu: boolean,
  setAttachmentRef: ?(?React.Component<any, any>) => void,
  setShowingMenu: boolean => void,
  toggleShowingMenu: () => void,
}

type FloatingMenuParentState = {|
  attachmentRef: ?React.Component<any, any>,
  showingMenu: boolean,
|}

type FloatingMenuParentCallbacks = {|
  setShowingMenu: boolean => void,
  toggleShowingMenu: () => void,
  // WARNING: Only use setAttachmentRef on class components. Otherwise the ref will be
  // optimized out in production code!
  setAttachmentRef: ?(?React.Component<any, any>) => void,
|}

export const FloatingMenuParentHOC = <T: FloatingMenuParentProps>(
  ComposedComponent: React.ComponentType<T>
): React.ComponentType<$Diff<T, FloatingMenuParentProps>> => {
  class FloatingMenuParent extends React.Component<
    $Diff<T, FloatingMenuParentProps>,
    FloatingMenuParentState
  > {
    _setters: FloatingMenuParentCallbacks
    state = {attachmentRef: null, showingMenu: false}
    constructor(props: $Diff<T, FloatingMenuParentProps>) {
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
  return FloatingMenuParent
}
