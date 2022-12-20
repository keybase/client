import * as React from 'react'
import PlainInput, {type PropsWithInput} from './plain-input'
import {Box2} from './box'
import Text, {getStyle as getTextStyle} from './text'
import * as Styles from '../styles'
import {isMobile} from '../constants/platform'
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
  forwardedRef: React.Ref<PlainInput>
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

  // Style is supposed to switch when there's any input or its focused
  const actualValue = value !== undefined ? value : uncontrolledValue
  const populated = !!actualValue && actualValue.length > 0
  const multiline = props.multiline
  const collapsed = focused || populated || multiline

  // We're using fontSize to derive heights
  const textStyle = getTextStyle(props.textType || 'BodySemibold')
  const computedHeight =
    textStyle.fontSize * (props.rowsMax && multiline ? props.rowsMax * 1.3 : 1) + (isMobile ? 10 : 0)
  const computedContainerSize =
    textStyle.fontSize + (isMobile ? 48 : 38) + (multiline ? textStyle.fontSize : 0)

  const {containerStyle, error, forwardedRef, placeholder, ...plainInputProps} = props
  return (
    <Box2
      direction="vertical"
      gap="xsmall"
      gapStart={false}
      gapEnd={false}
      style={Styles.collapseStyles([
        styles.container,
        {height: !multiline ? computedContainerSize : undefined, minHeight: computedContainerSize},
        focused && styles.containerFocused,
        error && styles.containerError,
        containerStyle,
      ])}
    >
      <Box2
        direction="vertical"
        alignItems="flex-start"
        style={styles.labelWrapper}
        fullWidth={true}
        fullHeight={true}
        centerChildren={true}
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
      </Box2>
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
          {maxHeight: computedHeight},
          collapsed && styles.inputSmall,
          multiline && styles.inputMultiline,
        ])}
      />
    </Box2>
  )
}
ReflessLabeledInput.defaultProps = {
  flexable: true,
  keyboardType: 'default',
  textType: 'BodySemibold',
}

const LabeledInput = React.forwardRef<PlainInput, Props>(function LabeledInput(props, ref) {
  return <ReflessLabeledInput {...props} forwardedRef={ref} />
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
          position: 'relative',
          width: '100%',
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
      input: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.transparent,
          flexGrow: 1,
          marginTop: 14,
          paddingBottom: 3,
          paddingLeft: Styles.globalMargins.xsmall,
          paddingRight: Styles.globalMargins.xsmall,
          width: '100%',
        },
        isElectron: {
          marginTop: 14 + Styles.globalMargins.xsmall,
          zIndex: 0,
        },
      }),
      inputMultiline: Styles.platformStyles({
        isMobile: {
          textAlignVertical: 'top',
        } as const,
      }), // not sure why this fails
      inputSmall: {
        paddingTop: 0,
      },
      label: {
        alignSelf: 'flex-start',
        paddingLeft: Styles.globalMargins.xsmall,
        paddingRight: Styles.globalMargins.xsmall,
        zIndex: 0,
      },
      labelFocused: {
        color: Styles.globalColors.blueDark,
      },
      labelLarge: {
        color: Styles.globalColors.black_50,
      },
      labelSmall: Styles.platformStyles({
        common: {
          color: Styles.globalColors.black,
          height: '100%',
        },
        isElectron: {
          paddingTop: 6,
        },
        isMobile: {
          paddingTop: Styles.globalMargins.tiny,
        },
      }),
      labelWrapper: {
        position: 'absolute',
      },
    } as const)
)

export default LabeledInput
