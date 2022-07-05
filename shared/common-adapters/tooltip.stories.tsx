import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Styles from '../styles'
import Box, {Box2} from './box'
import Text from './text'
import WithTooltip from './with-tooltip'

const Kb = {
  Box,
  Box2,
  Text,
  WithTooltip,
}

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Tooltip', () => (
      <Kb.Box2 direction="horizontal" style={{flexWrap: 'wrap'}}>
        <Kb.WithTooltip tooltip="Here's a tooltip" containerStyle={styles.container} showOnPressMobile={true}>
          <Kb.Box style={styles.box}>
            <Kb.Text type="Body">Hover me for a short tooltip</Kb.Text>
          </Kb.Box>
        </Kb.WithTooltip>
        <Kb.WithTooltip
          containerStyle={styles.container}
          tooltip="Here's a multiline tooltip lalala blahblah wejoif jewiofj weoifjwof iwjeoif jweoifj weoifj woief"
          multiline={true}
          showOnPressMobile={true}
        >
          <Kb.Box style={styles.box}>
            <Kb.Text type="Body">Hover me for a long tooltip</Kb.Text>
          </Kb.Box>
        </Kb.WithTooltip>
        <Kb.WithTooltip
          containerStyle={styles.container}
          tooltip="Here's a short tooltip"
          position="bottom center"
          showOnPressMobile={true}
        >
          <Kb.Box style={styles.box}>
            <Kb.Text type="Body">Hover me for [bottom center]</Kb.Text>
          </Kb.Box>
        </Kb.WithTooltip>
        <Kb.WithTooltip
          containerStyle={styles.container}
          tooltip="Here's a short tooltip"
          position="top left"
          showOnPressMobile={true}
        >
          <Kb.Box style={styles.box}>
            <Kb.Text type="Body">Hover me for [top left]</Kb.Text>
          </Kb.Box>
        </Kb.WithTooltip>
        <Kb.WithTooltip
          containerStyle={styles.container}
          tooltip="Here's a short tooltip"
          position="top right"
          showOnPressMobile={true}
        >
          <Kb.Box style={styles.box}>
            <Kb.Text type="Body">Hover me for [top right]</Kb.Text>
          </Kb.Box>
        </Kb.WithTooltip>
        <Kb.WithTooltip
          containerStyle={styles.container}
          tooltip="Here's a short tooltip"
          position="bottom left"
          showOnPressMobile={true}
        >
          <Kb.Box style={styles.box}>
            <Kb.Text type="Body">Hover me for [bottom left]</Kb.Text>
          </Kb.Box>
        </Kb.WithTooltip>
        <Kb.WithTooltip
          containerStyle={styles.container}
          tooltip="Here's a short tooltip"
          position="bottom right"
          showOnPressMobile={true}
        >
          <Kb.Box style={styles.box}>
            <Kb.Text type="Body">Hover me for [bottom right]</Kb.Text>
          </Kb.Box>
        </Kb.WithTooltip>
      </Kb.Box2>
    ))
}

const styles = Styles.styleSheetCreate(() => ({
  box: {
    backgroundColor: Styles.globalColors.purple_40,
    color: Styles.globalColors.white,
    padding: Styles.globalMargins.xtiny,
    textAlign: 'center',
    width: 'auto',
  },
  container: {
    margin: Styles.globalMargins.xlarge,
  },
}))

export default load
