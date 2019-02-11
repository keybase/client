// @flow
import React, {Component} from 'react'
import type {Props} from './checkbox'
import {NativeTouchableWithoutFeedback, NativeAnimated, NativeEasing} from './native-wrappers.native'
import Box from './box'
import Text from './text'
import {collapseStyles, globalStyles, globalColors, globalMargins} from '../styles'

const checkedOffset = 20

type State = {
  left: any,
}

class Checkbox extends Component<Props, State> {
  state: State

  _getOffset(props: Props): number {
    return props.checked ? checkedOffset : 0
  }

  constructor(props: Props) {
    super(props)
    this.state = {left: new NativeAnimated.Value(this._getOffset(props))}
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.checked !== prevProps.checked) {
      NativeAnimated.timing(this.state.left, {
        duration: 100,
        easing: NativeEasing.linear,
        toValue: this._getOffset(this.props),
      }).start()
    }
  }

  shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
    return (
      this.props.disabled !== nextProps.disabled ||
      this.props.checked !== nextProps.checked ||
      this.props.label !== nextProps.label
    )
  }

  render() {
    const containerStyle = {
      opacity: this.props.disabled ? 0.4 : 1,
    }
    const onClick = this.props.disabled
      ? undefined
      : () => this.props.onCheck && this.props.onCheck(!this.props.checked)

    const animatedColor = this.state.left.interpolate({
      inputRange: [0, checkedOffset],
      outputRange: [globalColors.white, globalColors.blue],
    })

    const outerOverride = {
      ...(!this.props.checked && this.props.disabled ? {borderColor: globalColors.black_10} : {}),
      backgroundColor: animatedColor,
    }

    const innerOverride = {
      ...(!this.props.checked && this.props.disabled ? {borderColor: globalColors.black_10} : {}),
    }

    return (
      <NativeTouchableWithoutFeedback
        onPress={e => (e.defaultPrevented ? undefined : onClick && onClick())}
        delayPressIn={0}
      >
        <Box style={collapseStyles([styleContainer, containerStyle, this.props.style])}>
          <NativeAnimated.View style={{...styleOuter, ...outerOverride}}>
            <NativeAnimated.View style={{...styleInner, ...innerOverride, left: this.state.left}} />
          </NativeAnimated.View>
          {!!this.props.labelComponent && <Box style={styleLabel}>{this.props.labelComponent}</Box>}
          {!this.props.labelComponent && (
            <Text type="Body" style={collapseStyles([styleText, this.props.disabled && {opacity: 0.3}])}>
              {this.props.label}
            </Text>
          )}
        </Box>
      </NativeTouchableWithoutFeedback>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'flex-start',
  paddingBottom: globalMargins.xtiny,
  paddingTop: globalMargins.xtiny,
}

const styleOuter = {
  borderColor: globalColors.blue,
  borderRadius: 55,
  borderWidth: 1,
  height: 28,
  padding: 2,
  width: 48,
}

const styleInner = {
  backgroundColor: globalColors.white,
  borderColor: globalColors.blue,
  borderRadius: 16,
  borderWidth: 1,
  height: 22,
  width: 22,
}

const styleLabel = {
  flexShrink: 1,
  marginLeft: globalMargins.tiny,
}

const styleText = {
  ...styleLabel,
  color: globalColors.black_75,
  marginTop: globalMargins.xtiny,
}

export default Checkbox
