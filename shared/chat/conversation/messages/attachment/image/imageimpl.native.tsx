import * as Kb from '@/common-adapters'
import type * as T from '@/constants/types'
import {getAttachmentPreviewSize} from '../shared'

const ImageImpl = ({message}: {message: T.Chat.MessageAttachment}) => {
  const {previewURL, height, width} = getAttachmentPreviewSize(message, true)
  return <Kb.Image src={previewURL} style={Kb.Styles.collapseStyles([styles.image, {height, width}])} />
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  image: {
    backgroundColor: Kb.Styles.isIOS ? Kb.Styles.globalColors.black_05_on_white : undefined,
    maxHeight: 320,
    maxWidth: '100%',
  },
}))

export default ImageImpl
