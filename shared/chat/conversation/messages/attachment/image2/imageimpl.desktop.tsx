import * as React from 'react'
import * as Styles from '../../../../../styles'
import {useRedux} from './use-redux'

// its important we use explicit height/width so we never CLS while loading
const Image2Impl = () => {
  const {previewURL, height, width} = useRedux()
  return <img draggable={false} src={previewURL} height={height} width={width} style={styles.image as any} />
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      actionContainer: {
        alignSelf: 'flex-end',
        backgroundColor: Styles.globalColors.black_50,
        borderRadius: 2,
        overflow: 'hidden',
        padding: 1,
        paddingLeft: 4,
        paddingRight: 4,
        position: 'absolute',
        right: Styles.globalMargins.tiny,
        top: Styles.globalMargins.tiny,
      },
      image: Styles.platformStyles({
        isElectron: {
          ...Styles.globalStyles.rounded,
          maxHeight: 320,
          maxWidth: 320,
          objectFit: 'contain',
        },
      }),
    } as const)
)

export default Image2Impl
