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

const NewInput = React.forwardRef<PlainInput, Props>(function NewInputInner(props, ref) {
  const {textType = 'BodySemibold', onFocus: _onFocus, disabled, onBlur: _onBlur} = props
  const [focused, setFocused] = React.useState(false)

  const onFocus = React.useCallback(() => {
    if (disabled) {
      return
    }
    setFocused(true)
    _onFocus?.()
  }, [disabled, _onFocus])

  const onBlur = React.useCallback(() => {
    setFocused(false)
    _onBlur?.()
  }, [_onBlur])

  const textStyle = getTextStyle(textType)
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
        <Text type={textType} style={styles.prefix}>
          {prefix}
        </Text>
      )}
      <PlainInput {...plainInputProps} onFocus={onFocus} onBlur={onBlur} ref={ref} style={plainInputStyle} />
      {props.decoration}
    </Box2>
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
