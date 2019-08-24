import * as React from 'react'
import * as Styles from '../../styles'
import {Box2} from '../../common-adapters'
import {ImageViewProps} from './image-view'

const ImageView = (props: ImageViewProps) => (
  <Box2
    direction="vertical"
    fullWidth={true}
    fullHeight={true}
    centerChildren={true}
    style={styles.container}
  >
    <img src={props.url} draggable={false} style={styles.image} />
  </Box2>
)
const styles = Styles.styleSheetCreate({
  container: {
    padding: Styles.globalMargins.medium,
  },
  image: {
    maxHeight: '100%',
    maxWidth: '100%',
  },
})

export default ImageView
