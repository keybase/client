// @flow
import React, {Component} from 'react'
import {globalStyles} from '../styles'
import {getStyle as getTextStyle} from './text'

import type {Props} from './autosize-input'

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
        <div
          ref={el => {
            this._measureEl = el
          }}
          style={{
            ...resetStyle,
            whiteSpace: 'pre',
            ...this.props.inputStyle,
            position: 'absolute',
            left: -9999,
            top: -9999,
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
  padding: 0,
  border: 'none',
}

export default AutosizeInput
