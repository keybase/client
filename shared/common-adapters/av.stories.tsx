import * as React from 'react'
import * as Sb from '../stories/storybook'
import {Video} from './av'
import Box, {Box2} from './box'
import * as Styles from '../styles'

const starman =
  'https://archive.org/download/youtube%2DA0FZIwabctw/Falcon%5FHeavy%5FStarman%2DA0FZIwabctw%2Emp4'

const load = () => {
  Sb.storiesOf('Common/Video', module)
    .add('Starman', () => <Video url={starman} loop={true} controls={true} autoPlay={true} muted={true} />)
    .add('Starman Two', () => (
      <Box2 direction="vertical" gap="small" fullHeight={true} fullWidth={true} style={styles.bigBox}>
        <Box style={styles.smallBox}>
          <Video url={starman} loop={true} controls={true} autoPlay={true} muted={true} />
        </Box>
        <Box style={styles.smallBox}>
          <Video url={starman} loop={true} controls={true} autoPlay={true} muted={true} />
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
