import * as React from 'react'
import {Picker as EmojiPicker} from 'emoji-mart'
import {Props} from './picker'

class Picker extends React.Component<Props> {
  _focused: boolean = false
  // Setting autoFocus={true} on Picker doesn't work, so focus it
  // ourselves on mount/update.

  _focus = () => {
    if (this._focused) {
      return
    }
    this._focused = true
    setTimeout(() => {
      const node = document.querySelector<HTMLInputElement>('.emoji-mart input')
      node && node.focus()
    }, 1)
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
        title="reacjibase"
        onClick={data => data.colons && this.props.onClick({colons: data.colons})}
        backgroundImageFn={this.props.backgroundImageFn}
      />
    )
  }
}

export {Picker}
