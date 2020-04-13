import * as React from 'react'
import * as Styles from '../styles'
import {Props} from './custom-emoji'
import {FastImage} from './native-image.native'
import {Box2} from './box'

const CustomEmoji = (props: Props) => {
  const {size, src} = props
  const dimensions = {
    height: size,
    width: size,
  }
  return (
    <Box2
      direction="vertical"
      style={Styles.collapseStyles([dimensions, styles.container, !!props.addTopMargin && styles.topMargin])}
    >
      <FastImage source={{uri: src}} style={dimensions} resizeMode={FastImage.resizeMode.contain} />
    </Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    justifyContent: 'flex-end',
  },
  topMargin: {
    marginTop: Styles.globalMargins.tiny,
  },
}))

export default CustomEmoji
