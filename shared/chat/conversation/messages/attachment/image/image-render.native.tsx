import * as React from 'react'
import * as Kb from '../../../../../common-adapters/mobile.native'
import * as Styles from '../../../../../styles'
import {Props} from './image-render.types'

export const ImageRender = (props: Props) => (
  <Kb.Box2
    direction="vertical"
    style={[styles.container, props.style, {height: props.height, width: props.width}]}
  >
    <Kb.NativeFastImage
      onLoad={props.onLoad}
      source={{uri: props.src}}
      resizeMode="cover"
      style={styles.poster}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {position: 'relative'},
      poster: {...Styles.globalStyles.fillAbsolute, borderRadius: Styles.borderRadius},
      video: {borderRadius: Styles.borderRadius},
    } as const)
)

export function imgMaxWidth() {
  const {width: maxWidth} = Kb.NativeDimensions.get('window')
  return Math.min(320, maxWidth - 68)
}

export function imgMaxWidthRaw() {
  const {width: maxWidth} = Kb.NativeDimensions.get('window')
  return maxWidth
}
