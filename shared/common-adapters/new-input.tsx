import * as React from 'react'
import PlainInput, {type PropsWithInput} from './plain-input'
import Box, {Box2} from './box'
import Icon, {type IconType} from './icon'
import Text, {getStyle as getTextStyle} from './text'
import * as Styles from '@/styles'
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

const ReflessNewInput = React.forwardRef<PlainInput, Props & RefProps>((props, ref) => {
  const [focused, setFocused] = React.useState(false)

  const _onFocus = () => {
    if (props.disabled) {
      return
    }
    setFocused(true)
    props.onFocus && props.onFocus()
  }

  const _onBlur = () => {
    setFocused(false)
    props.onBlur && props.onBlur()
  }

  const textStyle = getTextStyle(props.textType ?? 'BodySemibold')
  const {containerStyle, decoration, error, hideBorder, icon, prefix, ...plainInputProps} = props
  const plainInputStyle = prefix
    ? Styles.collapseStyles([styles.prefixInput, plainInputProps.style])
    : plainInputProps.style

  return (
    <Box2
      direction="horizontal"
      style={Styles.collapseStyles([
        styles.container,
        focused && styles.focused,
        props.error && styles.error,
        props.hideBorder && styles.hideBorder,
        props.containerStyle,
      ])}
    >
      {!!props.icon && (
        <Box style={styles.icon}>
          <Icon
            color={Styles.globalColors.black_20} // not sure how to make this dynamic
            type={props.icon}
            fontSize={textStyle.fontSize}
            style={styles.displayFlex}
          />
        </Box>
      )}
      {!!prefix && (
        <Text type={plainInputProps.textType ?? 'Body'} style={styles.prefix}>
          {prefix}
        </Text>
      )}
      <PlainInput
        {...plainInputProps}
        onFocus={_onFocus}
        onBlur={_onBlur}
        ref={ref}
        style={plainInputStyle}
      />
      {props.decoration}
    </Box2>
  )
})

const NewInput = React.forwardRef<PlainInput, Props>(function NewInputInner(props, ref) {
  const flexable = props.flexable ?? true
  const keyboardType = props.keyboardType ?? 'default'
  const textType = props.textType ?? 'BodySemibold'
  return (
    <ReflessNewInput
      {...props}
      forwardedRef={ref}
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
          margin: 0,
          padding: Styles.globalMargins.xtiny,
        },
        isElectron: {width: '100%'},
      }),
      displayFlex: {display: 'flex'},
      error: {borderColor: Styles.globalColors.red},
      focused: {borderColor: Styles.globalColors.blue},
      hideBorder: {borderWidth: 0},
      icon: {marginRight: Styles.globalMargins.xtiny},
      prefix: Styles.platformStyles({isMobile: {alignSelf: 'flex-end'}}),
      prefixInput: {padding: 0},
    }) as const
)

export default NewInput
