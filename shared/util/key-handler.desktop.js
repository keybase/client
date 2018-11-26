// @flow
// HOC for a hotkey handler. Pass in hotkeys
import * as React from 'react'
import Mousetrap from 'mousetrap'

export type Props = {
  hotkeys: Array<string> | string,
  onHotkey: (key: string) => void,
}

function KeyHandlerHOC<P>(WrappedComponent: React.ComponentType<P & Props>): React.ComponentType<P & Props> {
  return class KeyHandler extends React.Component<P & Props> {
    componentDidMount() {
      Mousetrap.bind(
        this.props.hotkeys,
        (e, key) => {
          e.stopPropagation()
          key && this.props.onHotkey(key)
        },
        'keydown'
      )
    }

    componentWillUnmount() {
      Mousetrap.unbind(this.props.hotkeys)
    }

    render() {
      // $FlowIssue
      return <WrappedComponent {...this.props} />
    }
  }
}

export default KeyHandlerHOC
