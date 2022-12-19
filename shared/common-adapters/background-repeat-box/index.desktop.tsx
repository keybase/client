import Box from '../box'
import * as Styles from '../../styles'
import {urlsToImgSet} from '../icon.desktop'
import type {Props} from '.'
import {getAssetPath} from '../../constants/platform.desktop'

const BackgroundRepeatBox = (props: Props) => {
  let pattern = ''
  let patternUrl = ''
  if (!props.skipBackground) {
    pattern = getAssetPath(`../images/icons/${props.imageName}`)
    patternUrl = urlsToImgSet({[props.imageHeight]: pattern}, props.imageHeight)
  }
  return (
    <Box
      style={Styles.collapseStyles([
        !props.skipBackground && styles.backgroundRepeat,
        !props.skipBackground && {
          backgroundImage: patternUrl,
          backgroundSize: `${props.imageWidth}px ${props.imageHeight}px`,
        },
        props.style,
      ] as any)}
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
