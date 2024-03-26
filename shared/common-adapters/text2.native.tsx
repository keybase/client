import * as React from 'react'
import * as Styles from '@/styles'
import {fontSizeToSizeStyle, metaData} from './text.meta.native'
import type {Props} from './text2'
import {Text as RNText} from 'react-native'
import type {TextType} from './text.shared'
import {debugWarning} from '@/util/debug-warning'

const TEMP_MARK_V2 = __DEV__ && (false as boolean)
const TEMP_SWITCH = __DEV__ && (false as boolean)

if (TEMP_MARK_V2 || TEMP_SWITCH) {
  debugWarning('Text2 flags on')
}
// this is supposed to be faster with some tradeoffs but it doesn't work on text that updates
// the value doesn't show up on the native side
// type RNTextProps = React.ComponentProps<typeof RNText>
// const RCTText = (props: RNTextProps) => {
//   const {onLongPress, onPress, onPressIn, onPressOut, ...p} = props
//   return React.createElement('RCTText', p)
// }

const styles = Styles.styleSheetCreate(() =>
  Object.keys(metaData()).reduce<{[key: string]: Styles._StylesCrossPlatform}>((map, type) => {
    const meta = metaData()[type as TextType]
    map[type] = {
      ...fontSizeToSizeStyle(meta.fontSize),
      color: meta.colorForBackground['positive'] || Styles.globalColors.black,
      ...meta.styleOverride,
    } as Styles._StylesCrossPlatform
    return map
  }, {})
)

export const Text2 = /*TEMP_SWITCH
  ? require('./text').default
  : */ React.memo(function Text2(p: Props) {
  const {type: _type, style: _style, children: _children, lineClamp, selectable, ellipsizeMode} = p
  const type = _type ?? 'BodySmall'
  const canFixOverdraw = React.useContext(Styles.CanFixOverdrawContext)
  const style = React.useMemo(() => {
    const baseStyle: Styles.StylesCrossPlatform = styles[type]
    const overdrawStyle = canFixOverdraw ? {backgroundColor: Styles.globalColors.fastBlank} : undefined
    return Styles.collapseStyles([baseStyle, overdrawStyle, _style])
  }, [type, _style, canFixOverdraw])

  const clampProps = React.useMemo(() => {
    return lineClamp ? {ellipsizeMode, numberOfLines: lineClamp} : undefined
  }, [ellipsizeMode, lineClamp])

  let children = _children
  if (TEMP_MARK_V2) {
    if (children) {
      children = ['⚠', children]
    }
  }

  return (
    <RNText style={style} numberOfLines={lineClamp} selectable={selectable} {...clampProps}>
      {children}
    </RNText>
  )
})
