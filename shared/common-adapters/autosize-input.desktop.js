// @flow
import React, {Component} from 'react'
import {globalStyles} from '../styles'
import {getStyle as getTextStyle} from './text'

import type {Props} from './autosize-input'

type State = {
  measuredWidth: ?number,
}

class AutosizeInput extends Component<void, Props, State> {
  _inputEl: HTMLElement
  _measureEl: HTMLElement

  state = {
    measuredWidth: null,
  }

  componentDidMount() {
    this._measure()
  }

  componentDidUpdate() {
    this._measure()
  }

  _onChange = ev => {
    this.props.onChange(ev.target.value)
  }

  _measure() {
    // Defer until after rendered
    window.requestAnimationFrame(() => {
      const fudgeFactor = 1 // Need an extra pixel of space to prevent scrolling
      const measuredWidth = Math.ceil(this._measureEl.getBoundingClientRect().width) + fudgeFactor
      if (measuredWidth !== this.state.measuredWidth) {
        this.setState({measuredWidth})
      }
    })
  }

  focus() {
    this._inputEl.focus()
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
