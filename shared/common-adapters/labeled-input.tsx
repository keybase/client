import * as React from 'react'
import PlainInput, {PropsWithInput} from './plain-input'
import {Box2} from './box'
import Text from './text'
import * as Styles from '../styles'
import './input.css'

export type _Props = {
  containerStyle?: Styles.StylesCrossPlatform
  decoration?: React.ReactNode
  error?: boolean
}

export type Props = PropsWithInput<_Props>
type RefProps = {
  forwardedRef: React.Ref<PlainInput>
}

const ReflessLabeledInput = (props: Props & RefProps) => {
  const [focused, setFocused] = React.useState(false)

  const onFocus = React.useCallback(() => {
    setFocused(true)
    props.onFocus && props.onFocus()
  }, [])
  const onBlur = React.useCallback(() => {
    setFocused(false)
    props.onBlur && props.onBlur()
  }, [])

  // Style is supposed to switch when there's any input
  const populated = props.value && props.value.length > 0
  const collapsed = focused || populated

  const {containerStyle, error, forwardedRef, placeholder, ...plainInputProps} = props
  return (
    <Box2
      direction="vertical"
      gap="xsmall"
      gapStart={false}
      gapEnd={false}
      style={Styles.collapseStyles([
        styles.container,
        focused && styles.containerFocused,
        error && styles.containerError,
        containerStyle,
      ])}
    >
      <Box2
        direction="vertical"
        alignItems="flex-start"
        style={Styles.collapseStyles([styles.labelWrapper])}
        fullWidth={true}
        fullHeight={true}
        centerChildren={true}
      >
        <Text
          type={collapsed ? 'BodyTinySemibold' : 'BodySmallSemibold'}
          style={Styles.collapseStyles([
            styles.label,
            collapsed ? styles.labelSmall : styles.labelLarge,
            focused && styles.labelFocused,
          ])}
        >
          {placeholder}
        </Text>
      </Box2>

      <PlainInput
        {...plainInputProps}
        onFocus={onFocus}
        onBlur={onBlur}
        ref={props.forwardedRef}
        style={Styles.collapseStyles([styles.input, collapsed ? styles.inputSmall : styles.inputLarge])}
      />
    </Box2>
  )
}
ReflessLabeledInput.defaultProps = {
  flexable: true,
  keyboardType: 'default',
  textType: 'BodySemibold',
}

const LabeledInput = React.forwardRef<PlainInput, Props>((props, ref) => (
  <ReflessLabeledInput {...props} forwardedRef={ref} />
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
      height: 52,
      margin: 0,
      position: 'relative',
    },
    isElectron: {width: '100%'},
  }),
  containerError: {
    borderColor: Styles.globalColors.red,
  },
  containerFocused: {
    borderColor: Styles.globalColors.blue,
  },
  displayFlex: {
    display: 'flex',
  },
  hideBorder: {
    borderWidth: 0,
  },
  icon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  input: {
    backgroundColor: Styles.globalColors.transparent,
    height: '100%',
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
    position: 'absolute',
  },
  inputLarge: {},
  inputSmall: {
    paddingTop: Styles.globalMargins.small,
  },
  label: {
    alignSelf: 'flex-start',
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },
  labelFocused: {
    color: Styles.globalColors.blue,
  },
  labelLarge: {
    color: Styles.globalColors.black_50,
  },
  labelSmall: {
    color: Styles.globalColors.black,
    height: '100%',
    paddingTop: Styles.globalMargins.tiny,
  },
  labelWrapper: {
    position: 'absolute',
  },
}))

export default LabeledInput
