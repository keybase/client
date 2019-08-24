import * as React from 'react'
import * as Styles from '../../styles'
import {getStyle as getTextStyle} from '../../common-adapters/text'
import './autosize-input.css'

type Props = {
  autoFocus?: boolean
  value: string
  placeholder?: string
  inputStyle?: Object
  onChange: (text: string) => void
  onKeyDown?: (ev: React.KeyboardEvent) => void
  onFocus?: (ev: React.FocusEvent) => void
  onBlur?: (ev: React.FocusEvent) => void
}

type State = {
  measuredWidth: number | undefined
}

class AutosizeInput extends React.Component<Props, State> {
  _inputEl: HTMLElement | null = null
  _measureEl: HTMLElement | null = null
  _raf: number | undefined
  _mounted: boolean = false

  state = {measuredWidth: undefined}

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
    this._raf && window.cancelAnimationFrame(this._raf)
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
      <div style={Styles.collapseStyles([styles.container, {width: this.state.measuredWidth}])}>
        <input
          autoFocus={this.props.autoFocus}
          className="lighterPlaceholder"
          ref={el => {
            this._inputEl = el
          }}
          value={this.props.value}
          placeholder={this.props.placeholder}
          style={Styles.collapseStyles([styles.reset, this.props.inputStyle])}
          onChange={this._onChange}
          onKeyDown={this.props.onKeyDown}
          onFocus={this.props.onFocus}
          onBlur={this.props.onBlur}
        />
        <div
          ref={el => {
            this._measureEl = el
          }}
          style={Styles.collapseStyles([styles.reset, styles.div, this.props.inputStyle])}
        >
          {this.props.value || this.props.placeholder}
        </div>
      </div>
    )
  }
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
  },
  div: {
    left: -9999,
    position: 'absolute' as const,
    top: -9999,
    whiteSpace: 'pre',
  },
  reset: {
    ...getTextStyle('Body'),
    border: 'none',
    padding: 0,
  },
}))

export default AutosizeInput
