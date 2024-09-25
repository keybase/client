import Box from '@/common-adapters/box'
import * as Styles from '@/styles'
import {urlsToImgSet} from '@/common-adapters/icon.desktop'
import type {Props} from '.'
import {getAssetPath} from '@/constants/platform.desktop'

const BackgroundRepeatBox = (props: Props) => {
  let patternUrl = ''
  if (!props.skipBackground) {
    const pattern = getAssetPath(`../images/icons/${props.imageName}`)
    patternUrl = urlsToImgSet({[props.imageHeight]: pattern}, props.imageHeight) ?? ''
  }
  return (
    <Box
      style={Styles.collapseStyles([
        !props.skipBackground && styles.backgroundRepeat,
        !props.skipBackground &&
          Styles.platformStyles({
            isElectron: {
              backgroundImage: patternUrl,
              backgroundSize: `${props.imageWidth}px ${props.imageHeight}px`,
            },
          }),
        props.style,
      ])}
    >
      {props.children}
    </Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  backgroundRepeat: Styles.platformStyles({
    isElectron: {
      backgroundRepeat: 'repeat',
    },
  }),
}))

export default BackgroundRepeatBox
