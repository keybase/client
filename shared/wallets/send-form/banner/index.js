// @flow
import * as React from 'react'
import {Box2, Text} from '../../../common-adapters'
import {backgroundModeToColor, globalMargins, styleSheetCreate} from '../../../styles'

const backgroundMode = 'Announcements'

type Props = {
  text: string,
}

const Banner = (props: Props) => (
  <Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Text type="BodySemibold" style={styles.text} backgroundMode={backgroundMode}>
      {props.text}
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    backgroundColor: backgroundModeToColor[backgroundMode],
    padding: globalMargins.small,
    paddingBottom: globalMargins.tiny,
    paddingTop: globalMargins.tiny,
  },
  text: {
    textAlign: 'center',
  },
})

export default Banner
