import * as Styles from '../styles'
import {ZoomableBox} from './zoomable-box'
import Image2 from './image2.native'
import type {Props} from './zoomable-image'

const Kb = {
  Image2,
  ZoomableBox,
}

const ZoomableImage = (p: Props) => {
  const {src, style, onChanged, onLoaded} = p

  return (
    <Kb.ZoomableBox style={style} contentContainerStyle={styles.zoomableBoxContainer} onZoom={onChanged}>
      <Kb.Image2 src={src} style={styles.image} onLoad={onLoaded} showLoadingStateUntilLoaded={true} />
    </Kb.ZoomableBox>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      image: {flexGrow: 1},
      zoomableBoxContainer: {
        flex: 1,
        overflow: 'hidden',
        position: 'relative',
      },
    } as const)
)

export default ZoomableImage
