// @flow
import * as React from 'react'
import Box, {Box2} from './box'
import Text from './text'
import WithTooltip from './with-tooltip'
import {storiesOf} from '../stories/storybook'
import {globalMargins, globalColors, styleSheetCreate} from '../styles'

const load = () => {
  storiesOf('Common', module).add('Tooltip', () => (
    <Box2 direction="horizontal" style={{flexWrap: 'wrap'}}>
      <WithTooltip text="Here's a tooltip" containerStyle={styles.container}>
        <Box style={styles.box}>
          <Text type="Body">Hover me for a short tooltip</Text>
        </Box>
      </WithTooltip>
      <WithTooltip
        containerStyle={styles.container}
        text="Here's a multiline tooltip lalala blahblah wejoif jewiofj weoifjwof iwjeoif jweoifj weoifj woief"
        multiline={true}
      >
        <Box style={styles.box}>
          <Text type="Body">Hover me for a long tooltip</Text>
        </Box>
      </WithTooltip>
      <WithTooltip containerStyle={styles.container} text="Here's a short tooltip" position="bottom center">
        <Box style={styles.box}>
          <Text type="Body">Hover me for [bottom center]</Text>
        </Box>
      </WithTooltip>
      <WithTooltip containerStyle={styles.container} text="Here's a short tooltip" position="top left">
        <Box style={styles.box}>
          <Text type="Body">Hover me for [top left]</Text>
        </Box>
      </WithTooltip>
      <WithTooltip containerStyle={styles.container} text="Here's a short tooltip" position="top right">
        <Box style={styles.box}>
          <Text type="Body">Hover me for [top right]</Text>
        </Box>
      </WithTooltip>
      <WithTooltip containerStyle={styles.container} text="Here's a short tooltip" position="bottom left">
        <Box style={styles.box}>
          <Text type="Body">Hover me for [bottom left]</Text>
        </Box>
      </WithTooltip>
      <WithTooltip containerStyle={styles.container} text="Here's a short tooltip" position="bottom right">
        <Box style={styles.box}>
          <Text type="Body">Hover me for [bottom right]</Text>
        </Box>
      </WithTooltip>
    </Box2>
  ))
}

const styles = styleSheetCreate({
  container: {
    margin: globalMargins.xlarge,
  },
  box: {
    backgroundColor: globalColors.purple2_40,
    color: globalColors.white,
    padding: globalMargins.xtiny,
    textAlign: 'center',
    width: 'auto',
  },
})

export default load
