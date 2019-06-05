import React, {Component} from 'react'
import {globalStyles, globalColors} from '../../styles'
import {getStyle as getTextStyle} from '../../common-adapters/text'

type Props = {
  autoFocus?: boolean
  value: string
  placeholder?: string | null
  inputStyle?: Object
  onChange: (text: string) => void
  onKeyDown?: (ev: React.KeyboardEvent) => void
  onFocus?: (ev: React.FocusEvent) => void
  onBlur?: (ev: React.FocusEvent) => void
}

type State = {
  measuredWidth: number | null
}

class AutosizeInput extends Component<Props, State> {
  _inputEl: HTMLElement | null
  _measureEl: HTMLElement | null
  _raf: number
  _mounted: boolean = false

  state = {
    measuredWidth: null,
  }

  componentDidMount() {
    this._mounted = true
    this._measure()
    if (this.props.autoFocus && this._inputEl) {
      const el = this._inputEl
      // needs to be delayed for some reason, todo figure this out
      setTimeout(() => {
        el && el.focus && el.focus()
      }, 100)
    }
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
            position: 'absolute' as 'absolute',
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
