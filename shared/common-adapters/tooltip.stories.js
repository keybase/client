// @flow
import * as React from 'react'
import {Box2} from './box'
import Text from './text'
import ClickableBox from './clickable-box'
import {storiesOf} from '../stories/storybook'
import {globalMargins, globalColors, styleSheetCreate} from '../styles'

const load = () => {
  storiesOf('Common', module).add('Tooltip', () => (
    <Box2 direction="vertical" style={{alignItems: 'center'}}>
      <ClickableBox style={styles.clickableBox} tooltip="Here's a tooltip">
        <Text type="Body">Hover Me</Text>
      </ClickableBox>
      <ClickableBox
        style={styles.clickableBox}
        tooltip="Here's a multiline tooltip lalala blahblah wejoif jewiofj weoifjwof iwjeoif jweoifj weoifj woief"
        tooltipMultiline={true}
      >
        <Text type="Body">Hover Me</Text>
      </ClickableBox>
    </Box2>
  ))
}

const styles = styleSheetCreate({
  clickableBox: {
    marginTop: globalMargins.xlarge,
    backgroundColor: globalColors.black_20,
    textAlign: 'center',
    width: 72,
  },
})

export default load
