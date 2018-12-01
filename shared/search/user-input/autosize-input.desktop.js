// @flow
import React, {Component} from 'react'
import {globalStyles, globalColors} from '../../styles'
import {getStyle as getTextStyle} from '../../common-adapters/text'

type Props = {
  autoFocus?: boolean,
  value: string,
  placeholder?: ?string,
  inputStyle?: Object,
  onChange: (text: string) => void,
  onKeyDown?: (ev: SyntheticKeyboardEvent<>) => void,
  onFocus?: (ev: SyntheticInputEvent<>) => void,
  onBlur?: (ev: SyntheticInputEvent<>) => void,
}

type State = {
  measuredWidth: ?number,
}

class AutosizeInput extends Component<Props, State> {
  _inputEl: ?HTMLElement
  _measureEl: ?HTMLElement
  _raf: number
  _mounted: boolean = false

  state = {
    measuredWidth: null,
  }

  componentDidMount() {
    this._mounted = true
    this._measure()
  }

  componentDidUpdate() {
    this._measure()
  }

  componentWillUnmount() {
    this._mounted = false
    window.cancelAnimationFrame(this._raf)
  }

  _onChange = ev => {
    this.props.onChange(ev.target.value)
  }

  _measure() {
    // Defer until after rendered
    this._raf = window.requestAnimationFrame(() => {
      const fudgeFactor = 1 // Need an extra pixel of space to prevent scrolling
      const measuredWidth =
        Math.ceil(this._measureEl ? this._measureEl.getBoundingClientRect().width : 0) + fudgeFactor
      if (measuredWidth !== this.state.measuredWidth) {
        if (this._mounted) {
          this.setState({measuredWidth})
        }
      }
    })
  }

  focus() {
    this._inputEl && this._inputEl.focus()
  }

  render() {
    return (
      <div
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'stretch',
          width: this.state.measuredWidth,
        }}
      >
        <input
          autoFocus={this.props.autoFocus}
          className="lighterPlaceholder"
          ref={el => {
            this._inputEl = el
          }}
          value={this.props.value}
          placeholder={this.props.placeholder}
          style={{
            ...resetStyle,
            ...this.props.inputStyle,
          }}
          onChange={this._onChange}
          onKeyDown={this.props.onKeyDown}
          onFocus={this.props.onFocus}
          onBlur={this.props.onBlur}
        />
        <style>{placeholderColorCSS}</style>
        <div
          ref={el => {
            this._measureEl = el
          }}
          style={{
            ...resetStyle,
            left: -9999,
            ...this.props.inputStyle,
            position: 'absolute',
            top: -9999,
            whiteSpace: 'pre',
          }}
        >
          {this.props.value || this.props.placeholder}
        </div>
      </div>
    )
  }
}

const resetStyle = {
  ...getTextStyle('Body'),
  border: 'none',
  padding: 0,
}

const placeholderColorCSS = `
input.lighterPlaceholder::placeholder {
  color: ${globalColors.black_20};
}
`

export default AutosizeInput
