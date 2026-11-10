import * as Kb from '@/common-adapters'
import * as React from 'react'
import type * as T from '@/constants/types'
import {getAttachmentPreviewSize} from '../shared'

const ImageImpl = ({message}: {message: T.Chat.MessageAttachment}) => {
  const styles = useStyles()
  const {previewURL, height, width} = getAttachmentPreviewSize(message, true)
  // Desktop: a preview that fails to load is hidden, whatever the server answered, rather than drawn
  // broken: a thread drawn from a stale local copy can show a message another device deleted, until
  // the server's copy replaces it. A new URL is tried again. Native keeps Kb.Image's own retries,
  // which wait out the local server's restarts, so its image stays mounted.
  const [failedURL, setFailedURL] = React.useState<string>()
  if (!isMobile) {
    if (failedURL === previewURL) return null
    // explicit height/width so we never CLS while loading
    return (
      <img
        loading="lazy"
        draggable={false}
        src={previewURL}
        height={height}
        width={width}
        style={Kb.Styles.castStyleDesktop(styles.image)}
        onError={() => setFailedURL(previewURL)}
      />
    )
  }
  return <Kb.Image src={previewURL} style={Kb.Styles.collapseStyles([styles.image, {height, width}])} />
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
