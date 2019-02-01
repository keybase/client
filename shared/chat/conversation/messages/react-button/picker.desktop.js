// @flow
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import {Picker as EmojiPicker} from 'emoji-mart'
import {type Props} from './picker'

class Picker extends React.Component<Props> {
  _picker: EmojiPicker

  // Setting autoFocus={true} on Picker doesn't work, so focus it
  // ourselves on mount/update.

  _focus = () => {
    if (!this._picker) {
      return
    }
    const node = ReactDOM.findDOMNode(this._picker)
    // eslint-disable-next-line no-undef
    if (!node || !(node instanceof Element)) {
      return
    }
    const input = node.querySelector('input')
    if (!input) {
      return
    }
    setImmediate(() => input.focus())
  }

  componentDidMount() {
    this._focus()
  }

  componentDidUpdate() {
    this._focus()
  }

  render() {
    return (
      <EmojiPicker
        autoFocus={true}
        emoji="star-struck"
        ref={picker => (this._picker = picker)}
        title="reacjibase"
        onClick={this.props.onClick}
        backgroundImageFn={this.props.backgroundImageFn}
      />
    )
  }
}

export {Picker}
