import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {getAttachmentPreviewSize} from '../shared'

const ImageImpl = ({message}: {message: T.Chat.MessageAttachment}) => {
  const {previewURL, height, width} = getAttachmentPreviewSize(message, true)
  if (!Kb.Styles.isMobile) {
    // explicit height/width so we never CLS while loading
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
  return <Kb.Image src={previewURL} style={Kb.Styles.collapseStyles([styles.image, {height, width}])} />
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  image: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.globalStyles.rounded,
      maxHeight: 320,
      maxWidth: 320,
      objectFit: 'contain',
    },
    isMobile: {
      maxHeight: 320,
      maxWidth: '100%',
    },
    isIOS: {
      backgroundColor: Kb.Styles.globalColors.black_05_on_white,
    },
  }),
}))

export default ImageImpl
