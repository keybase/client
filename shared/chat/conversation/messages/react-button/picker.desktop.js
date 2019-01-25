// @flow
import * as React from 'react'
import {Picker as EmojiPicker} from 'emoji-mart'
import {type Props} from './picker'

class Picker extends React.Component<Props> {
  _picker = React.createRef()

  // Setting autoFocus={true} on Picker doesn't work, so focus it
  // ourselves on mount/update.

  _focus = () => {
    if (!this._picker) {
      return
    }
    const node = this._picker.current
    // eslint-disable-next-line no-undef
    if (!node || !(node instanceof Element)) {
      return
    }
    const input = node.querySelector('input')
    if (!input) {
      return
    }
    input.focus()
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
        ref={this._picker}
        title="reacjibase"
        onClick={this.props.onClick}
        backgroundImageFn={this.props.backgroundImageFn}
      />
    )
  }
}

export {Picker}
