import * as React from 'react'
import * as Styles from '../styles'
import {Props} from './custom-emoji'
import {FastImage} from './native-image.native'
import {Box2} from './box'

const CustomEmoji = (props: Props) => {
  const {size, src} = props
  return (
    <Box2 direction="vertical" style={styles.container}>
      <FastImage
        source={{uri: src}}
        style={{
          height: size,
          width: size,
        }}
      />
    </Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    justifyContent: 'flex-end',
    marginTop: Styles.globalMargins.tiny,
  },
}))

export default CustomEmoji
