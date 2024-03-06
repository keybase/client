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
  const {type: _type, style: _style, children, lineClamp} = p
  const type = _type ?? 'BodySmall'
  const style = React.useMemo(() => {
    const baseStyle: Styles.StylesCrossPlatform = styles[type]
    if (_style) return [baseStyle, _style]
    return baseStyle
  }, [type, _style])

  return (
    <RCTText style={style} numberOfLines={lineClamp}>
      ⚠{children}
    </RCTText>
  )
})
