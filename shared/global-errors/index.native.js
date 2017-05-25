// @flow
import React, {Component} from 'react'
import {
  Box,
  Text,
  Icon,
  HOCTimers,
  NativeScrollView,
  NativeTouchableWithoutFeedback,
} from '../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../styles'

import type {Props} from './index'

type Size = 'Closed' | 'Small' | 'Big'
type State = {
  size: Size,
  cachedSummary: ?string,
  cachedDetails: ?string,
}

class GlobalError extends Component<void, Props, State> {
  state: State
  timerID: any

  constructor(props: Props) {
    super(props)

    this.state = {
      cachedDetails: this._detailsForError(props.error),
      cachedSummary: this._summaryForError(props.error),
      size: 'Closed',
    }
  }

  componentWillMount() {
    this._resetError(!!this.props.error)
  }

  _onExpandClick = () => {
    this.setState({size: 'Big'})
    this._clearCountdown()
  }

  _clearCountdown() {
    this.props.clearTimeout(this.timerID)
    this.timerID = null
  }

  _resetError(newError: boolean) {
    this._clearCountdown()
    this.setState({size: newError ? 'Small' : 'Closed'})

    if (newError) {
      this.timerID = this.props.setTimeout(() => {
        // this.props.onDismiss()
      }, 3000)
    }
  }

  _summaryForError(err: ?Error): ?string {
    return err ? err.message && err.message.substring(0, 40) : null
  }

  _detailsForError(err: ?Error): ?string {
    return err ? err.stack : null
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.error !== this.props.error) {
      this.props.setTimeout(() => {
        this.setState({
          cachedDetails: this._detailsForError(nextProps.error),
          cachedSummary: this._summaryForError(nextProps.error),
        })
      }, nextProps.error ? 0 : 3000) // if its set, do it immediately, if its cleared set it in a bit
      this._resetError(!!nextProps.error)
    }
  }

  static maxHeightForSize(size: Size) {
    return {
      Big: 500,
      Closed: 0,
      Small: 35 + 20,
    }[size]
  }

  render() {
    const {onDismiss} = this.props
    const summary = this.state.cachedSummary
    const details = this.state.cachedDetails
    const maxHeight = GlobalError.maxHeightForSize(this.state.size)

    return (
      <Box style={{...containerStyle, maxHeight}}>
        <NativeTouchableWithoutFeedback onPress={this._onExpandClick}>
          <Box style={summaryRowStyle}>
            {summary &&
              <Icon
                type="iconfont-exclamation"
                style={{color: globalColors.white, marginRight: globalMargins.tiny}}
              />}
            <Text type="BodySmall" style={{color: globalColors.white, flex: 1, textAlign: 'center'}}>
              {summary}
            </Text>
            {summary &&
              <Icon
                type="iconfont-close"
                onClick={onDismiss}
                style={{color: globalColors.white_75, marginLeft: globalMargins.tiny}}
              />}
          </Box>
        </NativeTouchableWithoutFeedback>
        <NativeScrollView>
          <Text type="BodySmall" style={detailStyle}>
            {this.props.error && this.props.error.message}{'\n\n'}{details}
          </Text>
        </NativeScrollView>
      </Box>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.black_75,
  left: 0,
  overflow: 'hidden',
  position: 'absolute',
  right: 0,
  top: 0,
}

const summaryRowStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  minHeight: GlobalError.maxHeightForSize('Small'),
  padding: globalMargins.tiny,
  paddingTop: globalMargins.medium,
}

const detailStyle = {
  ...globalStyles.selectable,
  color: globalColors.white_75,
  fontSize: 13,
  lineHeight: 17,
  padding: globalMargins.xtiny,
  paddingTop: globalMargins.tiny,
}

export default HOCTimers(GlobalError)
