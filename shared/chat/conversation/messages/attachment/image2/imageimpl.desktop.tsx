import * as Kb from '@/common-adapters'
import {useState} from './use-state'

// its important we use explicit height/width so we never CLS while loading
const Image2Impl = () => {
  const {previewURL, height, width} = useState()
  return (
    <img
      loading="lazy"
      draggable={false}
      src={previewURL}
      height={height}
      width={width}
      style={Kb.Styles.castStyleDesktop(styles.image)}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      image: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.globalStyles.rounded,
          maxHeight: 320,
          maxWidth: 320,
          objectFit: 'contain',
        },
      }),
    }) as const
)

export default Image2Impl
