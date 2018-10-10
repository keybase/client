// @flow
import * as React from 'react'
import PlainInput, {type PropsWithInput, type KeyboardType} from './plain-input'
import Box, {Box2} from './box'
import Icon, {type IconType, castPlatformStyles} from './icon'
import {getStyle as getTextStyle, type TextType} from './text'
import {
  type StylesCrossPlatform,
  collapseStyles,
  globalColors,
  globalMargins,
  platformStyles,
  styleSheetCreate,
} from '../styles'
import {forwardRef} from '../util/react'

export type _Props = {
  containerStyle?: StylesCrossPlatform,
  decoration?: React.Node,
  error?: boolean,
  forwardedRef: React.Ref<typeof PlainInput>,
  hideBorder?: boolean,
  icon?: IconType,
}

type DefaultProps = {
  flexable: boolean,
  keyboardType: KeyboardType,
  textType: TextType,
}
type Props = PropsWithInput<_Props>

type State = {
  focused: boolean,
}

class ReflessNewInput extends React.Component<DefaultProps & Props, State> {
  static defaultProps = {
    flexable: true,
    keyboardType: 'default',
    textType: 'BodySemibold',
  }
  state: State = {
    focused: false,
  }

  _onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }

  render() {
    const textStyle = getTextStyle(this.props.textType)
    const {containerStyle, decoration, error, forwardedRef, hideBorder, icon, ...plainInputProps} = this.props
    return (
      <Box2
        direction="horizontal"
        style={collapseStyles([
          styles.container,
          this.state.focused && styles.focused,
          this.props.error && styles.error,
          this.props.hideBorder && styles.hideBorder,
          this.props.containerStyle,
        ])}
      >
        {!!this.props.icon && (
          <Box style={styles.icon}>
            <Icon
              color={globalColors.black_20}
              type={this.props.icon}
              fontSize={textStyle.fontSize}
              style={castPlatformStyles(styles.displayFlex)}
            />
          </Box>
        )}
        <PlainInput
          {...plainInputProps}
          onFocus={this._onFocus}
          onBlur={this._onBlur}
          ref={this.props.forwardedRef}
        />
        {this.props.decoration}
      </Box2>
    )
  }
}
const NewInput = forwardRef((props, ref) => <ReflessNewInput {...props} forwardedRef={ref} />)

const styles = styleSheetCreate({
  container: platformStyles({
    common: {
      alignItems: 'center',
      margin: 0,
      borderColor: globalColors.black_10,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      padding: globalMargins.xtiny,
    },
    isElectron: {width: '100%'},
  }),
  focused: {
    borderColor: globalColors.blue,
  },
  error: {
    borderColor: globalColors.red,
  },
  hideBorder: {
    borderWidth: 0,
  },
  displayFlex: {
    display: 'flex',
  },
  icon: {
    marginRight: globalMargins.xtiny,
  },
})

export default NewInput
