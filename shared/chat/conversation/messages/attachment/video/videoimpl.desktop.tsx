import * as React from 'react'
import * as Styles from '../../../../../styles'
import {useRedux} from './use-redux'

// its important we use explicit height/width so we never CLS while loading
const VideoImpl = () => {
  const {previewURL, height, width, url} = useRedux()
  return (
    <video
      height={height}
      width={width}
      poster={previewURL}
      preload="none"
      controls={true}
      playsInline={true}
      controlsList="nodownload nofullscreen noremoteplayback"
      style={styles.video as any}
    >
      <source src={url} />
    </video>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      video: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.rounded,
          maxHeight: 320,
          maxWidth: 320,
          objectFit: 'contain',
        },
      }),
    } as const)
)

export default VideoImpl
