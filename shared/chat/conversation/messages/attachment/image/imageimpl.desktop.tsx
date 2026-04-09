import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {getAttachmentPreviewSize} from '../shared'

// its important we use explicit height/width so we never CLS while loading
const ImageImpl = ({message}: {message: T.Chat.MessageAttachment}) => {
  const {previewURL, height, width} = getAttachmentPreviewSize(message, true)
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

export default ImageImpl
