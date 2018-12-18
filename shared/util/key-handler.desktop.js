// @flow
// HOC for a hotkey handler. Pass in hotkeys
import * as React from 'react'
import Mousetrap from 'mousetrap'

type HocExtractProps = {
  hotkeys: Array<string> | string,
  onHotkey: (key: string) => void,
}

function keyHandlerHOC<Config: {} & HocExtractProps>(
  Component: React.AbstractComponent<$Diff<Config, HocExtractProps>>
): React.AbstractComponent<Config & HocExtractProps> {
  return class KeyHandler extends React.Component<Config> {
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
      const {hotkeys, onHotkey, ...rest} = this.props
      return <Component {...rest} />
    }
  }
}

export default keyHandlerHOC
