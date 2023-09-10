import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import {useRedux} from './use-redux'

// its important we use explicit height/width so we never CLS while loading
const Image2Impl = () => {
  const {previewURL, height, width} = useRedux()
  return (
    <img
      loading="lazy"
      draggable={false}
      src={previewURL}
      height={height}
      width={width}
      style={styles.image as any}
    />
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      actionContainer: {
        alignSelf: 'flex-end',
        backgroundColor: Kb.Styles.globalColors.black_50,
        borderRadius: 2,
        overflow: 'hidden',
        padding: 1,
        paddingLeft: 4,
        paddingRight: 4,
        position: 'absolute',
        right: Kb.Styles.globalMargins.tiny,
        top: Kb.Styles.globalMargins.tiny,
      },
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
