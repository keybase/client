import * as React from 'react'
// @ts-ignore not converted
import PlainInput, {PropsWithInput, KeyboardType} from './plain-input'
// @ts-ignore not converted
import Box, {Box2} from './box'
// @ts-ignore not converted
import Icon, {IconType, castPlatformStyles} from './icon'
// @ts-ignore not converted
import {getStyle as getTextStyle, TextType} from './text'
import {
  StylesCrossPlatform,
  collapseStyles,
  globalColors,
  globalMargins,
  platformStyles,
  styleSheetCreate,
} from '../styles'

export type _Props = {
  containerStyle?: StylesCrossPlatform
  decoration?: React.ReactNode
  error?: boolean
  forwardedRef: React.Ref<typeof PlainInput>
  hideBorder?: boolean
  icon?: IconType
}

type DefaultProps = {
  flexable: boolean
  keyboardType: KeyboardType
  textType: TextType
}

type Props = PropsWithInput<_Props>

type State = {
  focused: boolean
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
type FRefProps = {
  flexable?: boolean
  keyboardType?: KeyboardType
  textType?: TextType
} & Props
type Diff<T, U> = T extends U ? never : T
const NewInput = React.forwardRef<
  Diff<
    FRefProps,
    {
      forwardedRef: React.Ref<typeof PlainInput>
    }
  >,
  PlainInput
>((props, ref) => <ReflessNewInput {...props} forwardedRef={ref} />)

const styles = styleSheetCreate({
  container: platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: globalColors.white,
      borderColor: globalColors.black_10,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      margin: 0,
      padding: globalMargins.xtiny,
    },
    isElectron: {width: '100%'},
  }),
  displayFlex: {
    display: 'flex',
  },
  error: {
    borderColor: globalColors.red,
  },
  focused: {
    borderColor: globalColors.blue,
  },
  hideBorder: {
    borderWidth: 0,
  },
  icon: {
    marginRight: globalMargins.xtiny,
  },
})

export default NewInput
