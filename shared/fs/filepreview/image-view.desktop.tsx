import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import type {ImageViewProps} from './image-view'

const ImageView = ({url, onUrlError}: ImageViewProps) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    fullHeight={true}
    centerChildren={true}
    style={styles.container}
  >
    <Kb.Image
      src={url}
      style={styles.image}
      draggable={false}
      showLoadingStateUntilLoaded={true}
      onError={onUrlError && (() => onUrlError('image loading error'))}
    />
  </Kb.Box2>
)
const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        padding: Styles.globalMargins.medium,
      },
      image: {
        maxHeight: '100%',
        maxWidth: '100%',
      },
    } as const)
)

export default ImageView
