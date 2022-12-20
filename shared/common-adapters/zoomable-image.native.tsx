import * as Styles from '../styles'
import {ZoomableBox} from './zoomable-box'
import Image from './image.native'

const Kb = {
  Image,
  ZoomableBox,
}

const ZoomableImage = (p: {src: string; style?: Styles.StylesCrossPlatform}) => {
  const {src, style} = p
  return (
    <Kb.ZoomableBox style={style} contentContainerStyle={styles.zoomableBoxContainer}>
      <Kb.Image src={src} style={styles.image} />
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
