import * as React from 'react'
import PlainInput, {type PropsWithInput} from './plain-input'
import Box, {Box2} from './box'
import Icon, {type IconType} from './icon'
import Text, {getStyle as getTextStyle} from './text'
import * as Styles from '../styles'
import './input.css'

export type _Props = {
  containerStyle?: Styles.StylesCrossPlatform
  decoration?: React.ReactNode
  error?: boolean
  hideBorder?: boolean
  icon?: IconType
  prefix?: string
}

type Props = PropsWithInput<_Props>
type RefProps = {
  forwardedRef: React.Ref<PlainInput>
}

type State = {
  focused: boolean
}

class ReflessNewInput extends React.Component<Props & RefProps, State> {
  static defaultProps = {
    flexable: true,
    keyboardType: 'default',
    textType: 'BodySemibold',
  }
  state: State = {
    focused: false,
  }

  _onFocus = () => {
    if (this.props.disabled) {
      return
    }
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }

  render() {
    const textStyle = getTextStyle(this.props.textType || 'BodySemibold')
    // prettier-ignore
    const {containerStyle, decoration, error, forwardedRef, hideBorder, icon, prefix, ...plainInputProps} = this.props
    const plainInputStyle = prefix
      ? Styles.collapseStyles([styles.prefixInput, plainInputProps.style])
      : plainInputProps.style
    return (
      <Box2
        direction="horizontal"
        style={Styles.collapseStyles([
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
              color={Styles.globalColors.black_20} // not sure how to make this dynamic
              type={this.props.icon}
              fontSize={textStyle.fontSize}
              style={styles.displayFlex}
            />
          </Box>
        )}
        {!!prefix && (
          <Text type={plainInputProps.textType || PlainInput.defaultProps.textType} style={styles.prefix}>
            {prefix}
          </Text>
        )}
        <PlainInput
          {...plainInputProps}
          onFocus={this._onFocus}
          onBlur={this._onBlur}
          ref={this.props.forwardedRef}
          style={plainInputStyle}
        />
        {this.props.decoration}
      </Box2>
    )
  }
}
const NewInput = React.forwardRef<PlainInput, Props>(function NewInputInner(props, ref) {
  return <ReflessNewInput {...props} forwardedRef={ref} />
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Styles.globalColors.white,
          borderColor: Styles.globalColors.black_10,
          borderRadius: 4,
          borderStyle: 'solid',
          borderWidth: 1,
          margin: 0,
          padding: Styles.globalMargins.xtiny,
        },
        isElectron: {width: '100%'},
      }),
      displayFlex: {
        display: 'flex',
      },
      error: {
        borderColor: Styles.globalColors.red,
      },
      focused: {
        borderColor: Styles.globalColors.blue,
      },
      hideBorder: {
        borderWidth: 0,
      },
      icon: {
        marginRight: Styles.globalMargins.xtiny,
      },
      prefix: Styles.platformStyles({isMobile: {alignSelf: 'flex-end'}}),
      prefixInput: {padding: 0},
    } as const)
)

export default NewInput
