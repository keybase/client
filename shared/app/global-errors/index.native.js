// @flow
import React, {Component} from 'react'
import {
  Box,
  Button,
  Text,
  Icon,
  NativeScrollView,
  List,
  HOCTimers,
  type PropsWithTimer,
} from '../../common-adapters/mobile.native'
import {globalStyles, globalColors, globalMargins, isIPhoneX, platformStyles} from '../../styles'
import {RPCError} from '../../util/errors'

import type {Props as _Props} from './index.types'

type Size = 'Closed' | 'Small' | 'Big'
type State = {
  size: Size,
  cachedSummary: ?string,
  cachedDetails: ?string,
}

type Props = PropsWithTimer<_Props>

class GlobalError extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)

    this.state = {
      cachedDetails: this._detailsForError(props.error),
      cachedSummary: this._summaryForError(props.error),
      size: 'Closed',
    }
  }

  componentDidMount() {
    this._resetError(!!this.props.error)
  }

  _onExpandClick = () => {
    this.setState({size: 'Big'})
  }

  _resetError(newError: boolean) {
    this.setState({size: newError ? 'Small' : 'Closed'})
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
        this.setState({
          cachedDetails: this._detailsForError(this.props.error),
          cachedSummary: this._summaryForError(this.props.error),
        })
      }, this.props.error ? 0 : 7000) // if it's set, do it immediately, if it's cleared set it in a bit
      this._resetError(!!this.props.error)
    }
    if (prevProps.debugDump !== this.props.debugDump) {
      this._resetError(this.props.debugDump.length > 0)
    }
  }

  static maxHeightForSize(size: Size) {
    return {
      Big: 500,
      Closed: 0,
      Small: 35 + 66 + (isIPhoneX ? globalMargins.medium : 0),
    }[size]
  }

  _renderItem = (index: number, item: string) => {
    return (
      <Text key={String(index)} type="BodySmall" style={{color: 'white', fontSize: 8, lineHeight: 8}}>
        {item}
        {'\n'}
      </Text>
    )
  }

  render() {
    if (this.state.size === 'Closed') {
      return null
    }

    const {onDismiss} = this.props
    const details = this.state.cachedDetails
    const maxHeight = GlobalError.maxHeightForSize(this.state.size)

    return (
      <Box style={{...containerStyle, maxHeight}}>
        <Box style={globalStyles.flexBoxColumn}>
          <Box
            style={{
              ...summaryRowStyle,
              paddingBottom: globalMargins.xtiny,
              paddingTop: globalMargins.medium,
              position: 'relative',
            }}
          >
            <Text
              type="BodySmallSemibold"
              style={{color: globalColors.white, flex: 1, textAlign: 'center'}}
              onClick={this._onExpandClick}
            >
              An error occurred.
            </Text>
            <Icon
              type="iconfont-close"
              onClick={onDismiss}
              style={closeIconStyle}
              color={globalColors.white_75}
              fontSize={21}
            />
          </Box>
          <Box style={summaryRowStyle}>
            <Button
              backgroundMode="Terminal"
              fullWidth={true}
              label="Please tell us"
              onClick={this.props.onFeedback}
              small={true}
              style={{width: '100%'}}
              type="Secondary"
            />
          </Box>
        </Box>
        {this.props.debugDump.length ? (
          <Box style={{flex: 1}}>
            <Button
              onClick={() => this.props.copyToClipboard(this.props.debugDump.join('\n'))}
              type="Primary"
              label="Copy"
            />
            <List
              items={this.props.debugDump}
              renderItem={this._renderItem}
              indexAsKey={true}
              style={{height: 500}}
              windowSize={30}
            />
          </Box>
        ) : (
          <NativeScrollView>
            <Text type="BodySmall" selectable={true} style={detailStyle}>
              {this.props.error && this.props.error.message}
              {'\n\n'}
              {details}
            </Text>
          </NativeScrollView>
        )}
      </Box>
    )
  }
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.black_75,
  left: 0,
  overflow: 'hidden',
  paddingTop: isIPhoneX ? globalMargins.medium : 0,
  position: 'absolute',
  right: 0,
  top: 0,
}

const summaryRowStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  flexShrink: 0,
  justifyContent: 'flex-start',
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.xsmall,
  paddingRight: globalMargins.xsmall,
  paddingTop: globalMargins.tiny,
}

const detailStyle = {
  color: globalColors.white_75,
  fontSize: 14,
  lineHeight: 19,
  padding: globalMargins.xtiny,
  paddingTop: globalMargins.tiny,
}

const closeIconStyle = platformStyles({
  isMobile: {
    position: 'absolute',
    right: globalMargins.xsmall,
    top: 24,
  },
})

export default HOCTimers(GlobalError)
