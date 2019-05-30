import * as React from 'react'
import Box from '../box'
import * as Styles from '../../styles'
import {resolveRootAsURL} from '../../desktop/app/resolve-root.desktop'
import {urlsToImgSet} from '../icon.desktop'
import {Props} from './index.types'

const BackgroundRepeatBox = (props: Props) => {
  let pattern = ''
  let patternUrl = ''
  if (!props.skipBackground) {
    pattern = resolveRootAsURL(`../images/icons/${props.imageName}`)
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
      ])}
    >
      {props.children}
    </Box>
  )
}

const styles = Styles.styleSheetCreate({
  backgroundRepeat: Styles.platformStyles({
    isElectron: {
      backgroundRepeat: 'repeat',
    },
  }),
})

export default BackgroundRepeatBox
