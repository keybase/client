// @flow
import React, {Component} from 'react'
import logger from '../../logger'
import {Box, Text, Icon, HOCTimers, type PropsWithTimer} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, transition} from '../../styles'
import {ignoreDisconnectOverlay} from '../../local-debug.desktop.js'
import {RPCError} from '../../util/errors'

import type {Props as _Props} from './index'

type Size = 'Closed' | 'Small' | 'Big'
type State = {
  size: Size,
  cachedSummary: ?string,
  cachedDetails: ?string,
}

type Props = PropsWithTimer<_Props>

class GlobalError extends Component<Props, State> {
  state: State
  timerID: ?TimeoutID
  _mounted: boolean = true

  constructor(props: Props) {
    super(props)

    this.state = {
      cachedDetails: this._detailsForError(props.error),
      cachedSummary: this._summaryForError(props.error),
      size: 'Closed',
    }
  }

  componentWillUnmount() {
    this._mounted = false
  }

  componentDidMount() {
    this._mounted = true
    this._resetError(!!this.props.error)
  }

  _onExpandClick = () => {
    this.setState({size: 'Big'})
    this._clearCountdown()
  }

  _clearCountdown() {
    if (this.timerID) {
      this.props.clearTimeout(this.timerID)
    }
    this.timerID = null
  }

  _resetError(newError: boolean) {
    this._clearCountdown()
    this.setState({size: newError ? 'Small' : 'Closed'})

    if (newError) {
      this.timerID = this.props.setTimeout(() => {
        this.props.onDismiss()
      }, 10000)
    }
  }

  _summaryForError(err: null | Error | RPCError): ?string {
    return err ? err.message : null
  }

  _detailsForError(err: null | Error | RPCError): ?string {
    return err ? err.stack : null
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.error !== this.props.error) {
      this.props.setTimeout(() => {
        if (this._mounted) {
          this.setState({
            cachedDetails: this._detailsForError(this.props.error),
            cachedSummary: this._summaryForError(this.props.error),
          })
        }
      }, this.props.error ? 0 : 7000) // if it's set, do it immediately, if it's cleared set it in a bit
      this._resetError(!!this.props.error)
    }
    if (prevProps.debugDump !== this.props.debugDump) {
      this._resetError(this.props.debugDump.length > 0)
    }
  }

  static maxHeightForSize(size: Size) {
    return {
      Big: 900,
      Closed: 0,
      Small: 35,
    }[size]
  }

  renderDaemonError() {
    if (ignoreDisconnectOverlay) {
      logger.warn('Ignoring disconnect overlay')
      return null
    }

    const message =
      (this.props.daemonError && this.props.daemonError.message) ||
      'Keybase is currently unreachable. Trying to reconnect you…'
    return (
      <Box style={containerOverlayStyle}>
        <Box style={overlayRowStyle}>
          <Text type="BodySemibold" style={{color: globalColors.white, textAlign: 'center'}}>
            {message}
          </Text>
        </Box>
        <Box style={overlayFillStyle}>
          <Icon type="icon-loader-connecting-266" />
        </Box>
      </Box>
    )
  }

  renderError() {
    const {onDismiss} = this.props
    const summary = this.state.cachedSummary
    const details = this.state.cachedDetails
    const maxHeight = GlobalError.maxHeightForSize(this.state.size)

    return (
      <Box style={{...containerStyle, ...containerErrorStyle, maxHeight}} onClick={this._onExpandClick}>
        <Box style={{...summaryRowStyle, ...summaryRowErrorStyle}}>
          {summary && (
            <Icon type="iconfont-exclamation" style={{marginRight: 8}} color={globalColors.white} />
          )}
          <Text type="BodyBig" style={{color: globalColors.white, textAlign: 'center', flex: 1}}>
            {summary}
          </Text>
          {summary && <Icon type="iconfont-close" onClick={onDismiss} color={globalColors.white_75} />}
        </Box>
        <Text type="BodyBig" selectable={true} style={detailStyle}>
          {this.props.debugDump.length ? this.props.debugDump.join('\n') : details}
        </Text>
      </Box>
    )
  }

  render() {
    if (this.props.daemonError) {
      return this.renderDaemonError()
    }
    return this.renderError()
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  left: 0,
  overflow: 'hidden',
  position: 'absolute',
  right: 0,
  top: 0,
  zIndex: 1000,
}

const containerErrorStyle = {
  ...transition('max-height'),
}

const summaryRowStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  padding: 8,
  position: 'relative',
}

const summaryRowErrorStyle = {
  backgroundColor: globalColors.black_75,
  minHeight: GlobalError.maxHeightForSize('Small'),
}

const detailStyle = {
  backgroundColor: globalColors.black_75,
  color: globalColors.white_75,
  padding: 8,
  paddingLeft: globalMargins.xlarge,
  paddingRight: globalMargins.xlarge,
  textAlign: 'center',
}

const containerOverlayStyle = {
  ...globalStyles.flexBoxColumn,
  bottom: 0,
  left: 0,
  position: 'absolute',
  right: 0,
  top: 0,
  zIndex: 1000,
}

const overlayRowStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  backgroundColor: globalColors.blue,
  justifyContent: 'center',
  padding: 8,
}

const overlayFillStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  backgroundColor: globalColors.white,
  flex: 1,
  justifyContent: 'center',
}

export default HOCTimers(GlobalError)
