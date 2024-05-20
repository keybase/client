import * as React from 'react'
import PlainInput, {type PropsWithInput} from './plain-input'
import {Box2} from './box'
import Text, {getStyle as getTextStyle} from './text'
import * as Styles from '@/styles'
import {isMobile} from '@/constants/platform'
import './input.css'

export type _Props = {
  containerStyle?: Styles.StylesCrossPlatform
  decoration?: React.ReactNode
  error?: boolean
  hoverPlaceholder?: string // placeholder while there is no text; if this is set then props.placholder is used as a label only.
  placeholder: string // placeholder while unselected, label while selected
}

export type Props = PropsWithInput<_Props>
type RefProps = {
  forwardedRef?: React.MutableRefObject<PlainInput | null>
}

const ReflessLabeledInput = (props: Props & RefProps) => {
  const [focused, setFocused] = React.useState(false)
  const {onBlur, onFocus} = props
  const _onFocus = React.useCallback(() => {
    if (props.disabled) {
      return
    }
    setFocused(true)
    onFocus && onFocus()
  }, [onFocus, props.disabled])
  const _onBlur = React.useCallback(() => {
    setFocused(false)
    onBlur && onBlur()
  }, [onBlur])

  // If we're uncontrolled, monitor the changes instead
  const {value, onChangeText} = props
  const [uncontrolledValue, setUncontrolledValue] = React.useState('')
  const _onChangeText = React.useCallback(
    (newValue: string) => {
      value === undefined && setUncontrolledValue(newValue)
      onChangeText && onChangeText(newValue)
    },
    [value, onChangeText]
  )

  // If we're uncontrolled its possible its been injected into unbeknownst to us
  // this is VERY hacky and we shouldn't leak out the ref directly, but thats a larger change
  // and this component is old and we should likely just rewrite it
  const maybeInjectedValue = props.forwardedRef?.current?.value
  // Style is supposed to switch when there's any input or its focused
  const actualValue = value !== undefined ? value : uncontrolledValue || maybeInjectedValue
  const populated = !!actualValue && actualValue.length > 0
  const multiline = props.multiline
  const collapsed = focused || populated || multiline

  // We're using fontSize to derive heights
  const textStyle = getTextStyle(props.textType || 'BodySemibold')
  const computedContainerSize =
    textStyle.fontSize + (isMobile ? 48 : 38) + (multiline ? textStyle.fontSize : 0)

  const {containerStyle, error, forwardedRef, placeholder, ...plainInputProps} = props
  return (
    <Box2
      direction="vertical"
      style={Styles.collapseStyles([
        styles.container,
        {height: !multiline ? computedContainerSize : undefined, minHeight: computedContainerSize},
        focused && styles.containerFocused,
        error && styles.containerError,
        containerStyle,
      ])}
    >
      <Text
        type={collapsed ? 'BodyTinySemibold' : isMobile ? 'BodySemibold' : 'BodySmallSemibold'}
        style={Styles.collapseStyles([
          styles.label,
          props.placeholderColor && {color: props.placeholderColor},
          collapsed ? styles.labelSmall : styles.labelLarge,
          focused && styles.labelFocused,
        ])}
      >
        {placeholder}
      </Text>
      <PlainInput
        {...plainInputProps}
        onChangeText={_onChangeText}
        onFocus={_onFocus}
        onBlur={_onBlur}
        placeholder={collapsed ? props.hoverPlaceholder : undefined}
        ref={props.forwardedRef}
        style={Styles.collapseStyles([
          styles.input,
          props.style,
          collapsed && styles.inputSmall,
          multiline && styles.inputMultiline,
        ])}
      />
    </Box2>
  )
}

const LabeledInput = React.forwardRef<PlainInput, Props>(function LabeledInput(props, ref) {
  const flexable = props.flexable ?? true
  const keyboardType = props.keyboardType ?? 'default'
  const textType = props.textType ?? 'BodySemibold'

  return (
    <ReflessLabeledInput
      {...props}
      forwardedRef={ref as any}
      flexable={flexable}
      keyboardType={keyboardType}
      textType={textType}
    />
  )
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
          justifyContent: 'center',
          margin: 0,
          position: 'relative',
          width: '100%',
        },
        isElectron: {width: '100%'},
      }),
      containerError: {borderColor: Styles.globalColors.red},
      containerFocused: {borderColor: Styles.globalColors.blue},
      displayFlex: {display: 'flex'},
      hideBorder: {borderWidth: 0},
      icon: {marginRight: Styles.globalMargins.xtiny},
      input: {
        backgroundColor: Styles.globalColors.transparent,
        flexGrow: 1,
        marginBottom: 22,
        marginTop: 22,
        paddingLeft: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.xsmall,
        width: '100%',
      },
      inputMultiline: Styles.platformStyles({
        isMobile: {
          textAlignVertical: 'top',
        } as const,
      }), // not sure why this fails
      inputSmall: {paddingTop: 0},
      label: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
          position: 'absolute',
        },
        isElectron: {pointerEvents: 'none'},
      }),
      labelFocused: {color: Styles.globalColors.blueDark},
      labelLarge: {color: Styles.globalColors.black_50},
      labelSmall: {
        color: Styles.globalColors.black,
        position: 'absolute',
        top: 2,
      },
    }) as const
)

export default LabeledInput
