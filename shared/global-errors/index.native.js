// @flow
import React, {Component} from 'react'
import {Box, Text, Icon, HOCTimers, NativeScrollView, NativeTouchableWithoutFeedback} from '../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../styles'

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
      cachedSummary: props.summary,
      cachedDetails: props.details,
    }
  }

  componentWillMount () {
    this._resetError(!!this.props.summary)
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
        // this.props.onDismiss()
      }, 3000)
    }
  }

  componentWillReceiveProps (nextProps: Props) {
    if (nextProps.summary !== this.props.summary ||
      nextProps.details !== this.props.details) {
      this.props.setTimeout(() => {
        this.setState({
          cachedSummary: nextProps.summary,
          cachedDetails: nextProps.details,
        })
      }, nextProps.summary ? 0 : 3000) // if its set, do it immediately, if its cleared set it in a bit
      this._resetError(!!nextProps.summary)
    }
  }

  static maxHeightForSize (size: Size) {
    return {
      'Closed': 0,
      'Small': 35 + 20,
      'Big': 500,
    }[size]
  }

  render () {
    const {onDismiss} = this.props
    const summary = this.state.cachedSummary
    const details = this.state.cachedDetails
    const maxHeight = GlobalError.maxHeightForSize(this.state.size)

    return (
      <Box style={{...containerStyle, maxHeight}}>
        <NativeTouchableWithoutFeedback onPress={this._onExpandClick}>
          <Box style={summaryRowStyle}>
            {summary && <Icon type='iconfont-exclamation' style={{color: globalColors.white, marginRight: 8}} />}
            <Text type='BodySmall' style={{color: globalColors.white, textAlign: 'center'}}>{summary}</Text>
            {summary && <Icon type='iconfont-close' onClick={onDismiss} style={{position: 'absolute', right: 8, color: globalColors.white_75, top: 20}} />}
          </Box>
        </NativeTouchableWithoutFeedback>
        <NativeScrollView>
          <Text type='BodySmall' style={detailStyle}>{details}</Text>
        </NativeScrollView>
      </Box>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  overflow: 'hidden',
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  backgroundColor: globalColors.black_75,
}

const summaryRowStyle = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'center',
  minHeight: GlobalError.maxHeightForSize('Small'),
  padding: 8,
  alignItems: 'center',
  position: 'relative',
}

const detailStyle = {
  ...globalStyles.selectable,
  color: globalColors.white_75,
  padding: 8,
  textAlign: 'center',
  paddingLeft: globalMargins.xlarge,
  paddingRight: globalMargins.xlarge,
}

export default HOCTimers(GlobalError)
