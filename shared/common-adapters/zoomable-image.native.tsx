import * as Styles from '../styles'
import {ZoomableBox} from './zoomable-box'
import Image2 from './image2.native'
import type {Props} from './zoomable-image'
import {Box2} from './box'

const Kb = {
  Box2,
  Image2,
  ZoomableBox,
}

// TODO
// setState in convo somwhere
// image2 not working on adnroid, path prefix?
const ZoomableImage = (p: Props) => {
  const {src, style, onChanged, onLoaded} = p

  console.log('aaa zoom render', style)

  // TEMP
  // return (
  //   <Kb.Box2 dir="vertical" style={[style, {backgroundColor: 'red'}]}>
  //     <Kb.Image2 src={src} style={styles.image} onLoad={onLoaded} />
  //   </Kb.Box2>
  // )
  return (
    <Kb.ZoomableBox style={style} contentContainerStyle={styles.zoomableBoxContainer} onZoom={onChanged}>
      <Kb.Image2 src={src} style={styles.image} onLoad={onLoaded} />
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
