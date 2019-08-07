import * as React from 'react'
import Box from '../box'
import * as Styles from '../../styles'
import {NativeImage} from '../native-wrappers.native'
import {Props} from './index.types'

const BackgroundRepeatBox = (props: Props) => {
  let backgroundImage: React.ReactNode = null
  if (!props.skipBackground) {
    backgroundImage = (
      <NativeImage source={props.imageName as number} resizeMode="repeat" style={styles.backgroundImage} />
    )
  }
  return (
    <Box style={Styles.collapseStyles([!props.skipBackground && styles.container, props.style])}>
      {backgroundImage}
      {props.children}
    </Box>
  )
}

const styles = Styles.styleSheetCreate({
  backgroundImage: {...Styles.globalStyles.fillAbsolute, height: 'auto', width: 'auto'},
  container: {
    position: 'relative',
  },
})

export default BackgroundRepeatBox
