import React, {Component} from 'react'
import logger from '../../logger'
import {Box, Text, Icon, HOCTimers, PropsWithTimer} from '../../common-adapters'
import {globalStyles, globalColors, globalMargins, platformStyles, transition} from '../../styles'
import {ignoreDisconnectOverlay} from '../../local-debug.desktop'
import {RPCError} from '../../util/errors'

import {Props as _Props} from './index.types'

type Size = 'Closed' | 'Small' | 'Big'

type State = {
  size: Size
  cachedSummary?: string
  cachedDetails?: string
}

type Props = PropsWithTimer<_Props>

class GlobalError extends Component<Props, State> {
  state: State
  timerID?: NodeJS.Timeout
  _mounted: boolean = false

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
    this.timerID = undefined
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

  _summaryForError(err: null | Error | RPCError) {
    return err ? err.message : undefined
  }

  _detailsForError(err: null | Error | RPCError) {
    return err ? err.stack : undefined
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.error !== this.props.error) {
      this.props.setTimeout(
        () => {
          if (this._mounted) {
            this.setState({
              cachedDetails: this._detailsForError(this.props.error),
              cachedSummary: this._summaryForError(this.props.error),
            })
          }
        },
        this.props.error ? 0 : 7000
      ) // if it's set, do it immediately, if it's cleared set it in a bit
      this._resetError(!!this.props.error)
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
          <Text center={true} type="BodySmallSemibold" style={{color: globalColors.white}}>
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
          <Text center={true} type="BodyBig" style={{color: globalColors.white, flex: 1}}>
            {summary}
          </Text>
          {summary && (
            <Icon
              color={globalColors.white_75}
              hoverColor={globalColors.white}
              onClick={onDismiss}
              style={closeIconStyle}
              type="iconfont-close"
            />
          )}
        </Box>
        <Text center={true} type="BodyBig" selectable={true} style={detailStyle}>
          {details}
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
  backgroundColor: globalColors.black,
  minHeight: GlobalError.maxHeightForSize('Small'),
}

const detailStyle = {
  backgroundColor: globalColors.black,
  color: globalColors.white_75,
  padding: 8,
  paddingLeft: globalMargins.xlarge,
  paddingRight: globalMargins.xlarge,
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

const closeIconStyle = platformStyles({
  isElectron: {
    position: 'absolute',
    right: globalMargins.xsmall,
    top: globalMargins.xsmall,
  },
})

export default HOCTimers(GlobalError)
