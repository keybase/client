import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {getAttachmentPreviewSize} from '../shared'

const ImageImpl = ({message}: {message: T.Chat.MessageAttachment}) => {
  const styles = useStyles()
  const {previewURL, height, width} = getAttachmentPreviewSize(message, true)
  // A preview that fails to load is hidden, whatever the server answered, rather than drawn broken:
  // a thread drawn from a stale local copy can show a message another device deleted, until the
  // server's copy replaces it. A new URL is tried again.
  const [failedURL, setFailedURL] = React.useState<string>()
  if (failedURL === previewURL) return null
  const onError = () => setFailedURL(previewURL)
  if (!isMobile) {
    // explicit height/width so we never CLS while loading
    return (
      <img
        loading="lazy"
        draggable={false}
        src={previewURL}
        height={height}
        width={width}
        style={Kb.Styles.castStyleDesktop(styles.image)}
        onError={onError}
      />
    )
  }
  return <Kb.Image src={previewURL} style={Kb.Styles.collapseStyles([styles.image, {height, width}])} onError={onError} />
}

const useStyles = Kb.Styles.createStyleHook(theme => ({
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
      backgroundColor: theme.black_05_on_white,
    },
  }),
}))

export default ImageImpl
