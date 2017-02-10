// @flow
import React, {Component} from 'react'
import {Box, Text, Icon, HOCTimers} from '../common-adapters'
import {globalStyles, globalColors, globalMargins, transition} from '../styles'
import {ReachabilityReachable} from '../constants/types/flow-types'
import {ignoreDisconnectOverlay} from '../local-debug.desktop.js'

import type {Props} from './index'

type Size = 'Closed' | 'Small' | 'Big'
type State = {
  size: Size,
  cachedSummary: ?string,
  cachedDetails: ?string,
}

class GlobalError extends Component<void, Props, State> {
  state: State;
  timerID: any;

  constructor (props: Props) {
    super(props)

    this.state = {
      size: 'Closed',
      cachedSummary: this._summaryForError(props.error),
      cachedDetails: this._detailsForError(props.error),
    }
  }

  componentWillMount () {
    this._resetError(!!this.props.error)
  }

  _onExpandClick = () => {
    this.setState({size: 'Big'})
    this._clearCountdown()
  }

  _clearCountdown () {
    this.props.clearTimeout(this.timerID)
    this.timerID = null
  }

  _resetError (newError: boolean) {
    this._clearCountdown()
    this.setState({size: newError ? 'Small' : 'Closed'})

    if (newError) {
      this.timerID = this.props.setTimeout(() => {
        this.props.onDismiss()
      }, 5000)
    }
  }

  _summaryForError (err: ?Error): ?string {
    return err ? err.message : null
  }

  _detailsForError (err: ?Error): ?string {
    return err ? err.stack : null
  }

  componentWillReceiveProps (nextProps: Props) {
    if (nextProps.error !== this.props.error) {
      this.props.setTimeout(() => {
        this.setState({
          cachedSummary: this._summaryForError(nextProps.error),
          cachedDetails: this._detailsForError(nextProps.error),
        })
      }, nextProps.error ? 0 : 3000) // if its set, do it immediately, if its cleared set it in a bit
      this._resetError(!!nextProps.error)
    }
  }

  static maxHeightForSize (size: Size) {
    return {
      'Closed': 0,
      'Small': 35,
      'Big': 900,
    }[size]
  }

  renderReachability () {
    if (ignoreDisconnectOverlay) {
      console.warn('Ignoring disconnect overlay')
      return null
    }

    const message = this.props.daemonError && this.props.daemonError.message || 'Keybase is currently unreachable. Trying to reconnect you…'
    return (
      <Box style={{...containerOverlayStyle}}>
        <Box style={{...overlayRowStyle}}>
          <Text type='BodySemibold' style={{color: globalColors.white, textAlign: 'center'}}>{message}</Text>
        </Box>
        <Box style={{...overlayFillStyle}}>
          <Icon type='icon-loader-connecting-266' />
        </Box>
      </Box>
    )
  }

  renderError () {
    const {onDismiss} = this.props
    const summary = this.state.cachedSummary
    const details = this.state.cachedDetails
    const maxHeight = GlobalError.maxHeightForSize(this.state.size)

    return (
      <Box style={{...containerStyle, ...containerErrorStyle, maxHeight}} onClick={this._onExpandClick}>
        <Box style={{...summaryRowStyle, ...summaryRowErrorStyle}}>
          {summary && <Icon type='iconfont-exclamation' style={{color: globalColors.white, marginRight: 8}} />}
          <Text type='BodyBig' style={{color: globalColors.white, textAlign: 'center'}}>{summary}</Text>
          {summary && <Icon type='iconfont-close' onClick={onDismiss} style={{position: 'absolute', right: 8, color: globalColors.white_75}} />}
        </Box>
        <Text type='BodyBig' style={detailStyle}>{details}</Text>
      </Box>
    )
  }

  render () {
    if (this.props.reachability && this.props.reachability.reachable === ReachabilityReachable.no) {
      return this.renderReachability()
    } else if (this.props.daemonError) {
      return this.renderReachability()
    }
    return this.renderError()
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  overflow: 'hidden',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
}

const containerErrorStyle = {
  ...transition('max-height'),
}

const summaryRowStyle = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  position: 'relative',
  padding: 8,
}

const summaryRowErrorStyle = {
  backgroundColor: globalColors.black_75,
  minHeight: GlobalError.maxHeightForSize('Small'),
}

const detailStyle = {
  ...globalStyles.selectable,
  color: globalColors.white_75,
  backgroundColor: globalColors.black_75,
  padding: 8,
  textAlign: 'center',
  paddingLeft: globalMargins.xlarge,
  paddingRight: globalMargins.xlarge,
}

const containerOverlayStyle = {
  ...globalStyles.flexBoxColumn,
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  bottom: 0,
}

const overlayRowStyle = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 8,
  backgroundColor: globalColors.blue,
}

const overlayFillStyle = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: globalColors.white,
}

export default HOCTimers(GlobalError)
