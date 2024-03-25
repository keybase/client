import * as React from 'react'
import {NativeAnimated, NativeEasing} from './native-wrappers.native'
import * as Styles from '@/styles'
import type {Props} from './switch-toggle'

class SwitchToggle extends React.PureComponent<Props> {
  _offset = new NativeAnimated.Value(this._getOffset())
  _animation: NativeAnimated.CompositeAnimation | undefined

  _getOffset() {
    return this.props.on ? enabledOffset : disabledOffset
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.on === this.props.on) {
      return
    }
    this._animation?.stop()
    this._animation = NativeAnimated.timing(this._offset, {
      duration: 100,
      easing: NativeEasing.linear,
      toValue: this._getOffset(),
      useNativeDriver: false,
    })
    this._animation.start()
  }
  render() {
    return (
      <NativeAnimated.View
        style={[
          styles.outer,
          {
            backgroundColor: this._offset.interpolate({
              inputRange: [disabledOffset, enabledOffset],
              outputRange: [
                Styles.undynamicColor(Styles.globalColors.greyDark),
                Styles.undynamicColor(Styles.globalColors[this.props.color]),
              ],
            }),
          },
          this.props.style,
        ]}
      >
        <NativeAnimated.View style={[styles.inner, {marginLeft: this._offset}]} />
      </NativeAnimated.View>
    )
  }
}

export default SwitchToggle

const disabledOffset = 2
const enabledOffset = 22

const styles = Styles.styleSheetCreate(() => ({
  inner: {
    backgroundColor: Styles.undynamicColor(Styles.globalColors.white),
    borderRadius: 12,
    height: 24,
    width: 24,
  },
  outer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    borderRadius: 14,
    flexShrink: 0,
    height: 28,
    width: 48,
  },
}))
