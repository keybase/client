import * as React from 'react'
import PlainInput, {PropsWithInput} from './plain-input'
import Box, {Box2} from './box'
import Icon, {IconType, castPlatformStyles} from './icon'
import {getStyle as getTextStyle} from './text'
import * as Styles from '../styles'

export type _Props = {
  containerStyle?: Styles.StylesCrossPlatform
  decoration?: React.ReactNode
  error?: boolean
  hideBorder?: boolean
  icon?: IconType
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
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }

  render() {
    const textStyle = getTextStyle(this.props.textType || 'BodySemibold')
    const {containerStyle, decoration, error, forwardedRef, hideBorder, icon, ...plainInputProps} = this.props
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
const NewInput = React.forwardRef<PlainInput, Props>((props, ref) => (
  <ReflessNewInput {...props} forwardedRef={ref} />
))

const styles = Styles.styleSheetCreate(() => ({
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
}))

export default NewInput
