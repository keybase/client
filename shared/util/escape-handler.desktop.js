// @flow
import {Component} from 'react'
import PropTypes from 'prop-types'

import type {GlobalProps, Props} from './escape-handler'

class EscapeHandler extends Component<void, Props, void> {
  static contextTypes = {
    addESCHandler: PropTypes.func,
    removeESCHandler: PropTypes.func,
  }

  componentDidMount() {
    this.context.addESCHandler(this)
  }

  componentWillUnmount() {
    this.context.removeESCHandler(this)
  }

  onESC() {
    this.props.onESC()
  }

  render() {
    return this.props.children
  }
}

class GlobalEscapeHandler extends Component<void, GlobalProps, void> {
  _stack: Array<EscapeHandler> = []

  componentDidMount() {
    document.body && document.body.addEventListener('keydown', this._handleESC)
  }

  componentWillUnmount() {
    document.body && document.body.removeEventListener('keydown', this._handleESC)
  }

  static childContextTypes = {
    addESCHandler: PropTypes.func,
    removeESCHandler: PropTypes.func,
  }

  getChildContext() {
    return {
      addESCHandler: this.add,
      removeESCHandler: this.remove,
    }
  }

  _handleESC = (ev: KeyboardEvent) => {
    if (ev.key !== 'Escape') {
      return
    }
    const receiver = this._stack.pop()
    if (!receiver) {
      return
    }
    receiver.onESC()
  }

  add = (receiver: EscapeHandler) => {
    this._stack.push(receiver)
  }

  remove = (receiver: EscapeHandler) => {
    const idx = this._stack.indexOf(receiver)
    if (idx !== -1) {
      this._stack.splice(idx, 1)
    }
  }

  render() {
    return this.props.children
  }
}

export {GlobalEscapeHandler}

export default EscapeHandler
