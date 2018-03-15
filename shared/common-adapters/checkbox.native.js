// @flow
import React, {Component} from 'react'
import type {Props} from './checkbox'
import {NativeTouchableWithoutFeedback, NativeAnimated, NativeEasing} from './native-wrappers.native'
import Box from './box'
import Text from './text'
import {globalStyles, globalColors, globalMargins} from '../styles'

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

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.checked !== nextProps.checked) {
      NativeAnimated.timing(this.state.left, {
        toValue: this._getOffset(nextProps),
        duration: 100,
        easing: NativeEasing.linear,
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
        <Box style={{...styleContainer, ...containerStyle, ...this.props.style}}>
          <NativeAnimated.View style={{...styleOuter, ...outerOverride}}>
            <NativeAnimated.View style={{...styleInner, ...innerOverride, left: this.state.left}} />
          </NativeAnimated.View>
          <Text type="Body" style={styleText}>
            {this.props.labelComponent || this.props.label}
          </Text>
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
  height: 28,
  width: 48,
  borderWidth: 1,
  borderColor: globalColors.blue,
  borderRadius: 55,
  padding: 2,
}

const styleInner = {
  height: 22,
  width: 22,
  backgroundColor: globalColors.white,
  borderWidth: 1,
  borderColor: globalColors.blue,
  borderRadius: 16,
}

const styleText = {
  marginLeft: globalMargins.tiny,
  marginTop: globalMargins.xtiny,
  color: globalColors.black_75,
  flexShrink: 1,
}

export default Checkbox
