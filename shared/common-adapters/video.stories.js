// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import Video from './video'
import Box, {Box2} from './box'
import * as Styles from '../styles'

const load = () => {
  Sb.storiesOf('Common/Video', module)
    .add('Starman', () => (
      <Video url="https://archive.org/download/youtube-A0FZIwabctw/Falcon_Heavy_Starman-A0FZIwabctw.mp4" />
    ))
    .add('Starman Two', () => (
      <Box2 direction="vertical" gap="small" fullHeight={true} fullWidth={true} style={styles.bigBox}>
        <Box style={styles.smallBox}>
          <Video url="https://archive.org/download/youtube-A0FZIwabctw/Falcon_Heavy_Starman-A0FZIwabctw.mp4" />
        </Box>
        <Box style={styles.smallBox}>
          <Video url="https://archive.org/download/youtube-A0FZIwabctw/Falcon_Heavy_Starman-A0FZIwabctw.mp4" />
        </Box>
      </Box2>
    ))
    .add('Deadman', () => (
      <Video url={'http://127.0.0.1/this-should-not-show-video-otherwise-"alert("FAIL")'} />
    ))
}

const styles = Styles.styleSheetCreate({
  bigBox: {
    backgroundColor: Styles.globalColors.red,
  },
  smallBox: {
    backgroundColor: Styles.globalColors.blue,
    height: 300,
    width: 300,
  },
})

export default load
