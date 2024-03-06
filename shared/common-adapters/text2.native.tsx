import * as React from 'react'
import * as Styles from '@/styles'
import {fontSizeToSizeStyle, metaData} from './text.meta.native'
import type {Props} from './text2'
import type {Text as RNText} from 'react-native'
import type {TextType} from './text.shared'

type RNTextProps = React.ComponentProps<typeof RNText>
const RCTText = (props: RNTextProps) => {
  const {onLongPress, onPress, onPressIn, onPressOut, ...p} = props
  return React.createElement('RCTText', p)
}

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

export const Text2 = React.memo(function Text2(p: Props) {
  const {type: _type, style: _style, children, lineClamp, selectable, ellipsizeMode} = p
  const type = _type ?? 'BodySmall'
  const canFixOverdraw = React.useContext(Styles.CanFixOverdrawContext)
  const style = React.useMemo(() => {
    const baseStyle: Styles.StylesCrossPlatform = styles[type]
    const overdrawStyle = canFixOverdraw ? {backgroundColor: Styles.globalColors.fastBlank} : undefined
    return Styles.collapseStyles([baseStyle, _style, overdrawStyle])
  }, [type, _style, canFixOverdraw])

  const clampProps = React.useMemo(() => {
    return lineClamp ? {ellipsizeMode, numberOfLines: lineClamp} : undefined
  }, [ellipsizeMode, lineClamp])

  return (
    <RCTText style={style} numberOfLines={lineClamp} selectable={selectable} {...clampProps}>
      ⚠{children}
    </RCTText>
  )
})
