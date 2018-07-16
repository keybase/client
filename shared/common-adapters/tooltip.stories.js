// @flow
import * as React from 'react'
import Box, {Box2} from './box'
import Text from './text'
import WithTooltip from './with-tooltip'
import {storiesOf} from '../stories/storybook'
import {globalMargins, globalColors, styleSheetCreate} from '../styles'

const load = () => {
  storiesOf('Common', module).add('Tooltip', () => (
    <Box2 direction="vertical" style={{alignItems: 'center'}}>
      <WithTooltip text="Here's a tooltip" containerStyle={styles.container}>
        <Box style={styles.box}>
          <Text type="Body">Hover Me</Text>
        </Box>
      </WithTooltip>
      <WithTooltip
        containerStyle={styles.container}
        text="Here's a multiline tooltip lalala blahblah wejoif jewiofj weoifjwof iwjeoif jweoifj weoifj woief"
        multiline={true}
      >
        <Box style={styles.box}>
          <Text type="Body">Hover Me</Text>
        </Box>
      </WithTooltip>
    </Box2>
  ))
}

const styles = styleSheetCreate({
  container: {
    marginTop: globalMargins.xlarge,
  },
  box: {
    backgroundColor: globalColors.black_20,
    textAlign: 'center',
    width: 72,
  },
})

export default load
