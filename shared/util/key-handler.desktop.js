// @flow

// HOC for a hotkey handler. Pass in hotkeys
import {lifecycle} from 'recompose'
import Mousetrap from 'mousetrap'

export type Props = {
  hotkeys: Array<string> | string,
  onHotkey: (key: string) => void,
}

export default lifecycle({
  componentDidMount: function() {
    Mousetrap.bind(
      this.props.hotkeys,
      (e, key) => {
        e.stopPropagation()
        this.props.onHotkey(key)
      },
      'keydown'
    )
  },
  componentWillUnmount: function() {
    Mousetrap.unbind(
      this.props.hotkeys,
      (e, key) => {
        e.stopPropagation()
        this.props.onHotkey(key)
      },
      'keydown'
    )
  },
})
