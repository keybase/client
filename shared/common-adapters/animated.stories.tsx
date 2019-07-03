import * as React from 'react'
import * as Sb from '../stories/storybook'
import * as Kb from '.'
import * as Styles from '../styles'

const load = () => {
  Sb.storiesOf('Common', module).add('Animated', () => (
    <Kb.Animated config={{delay: 1000}} from={{left: 0}} to={{left: 300}}>
      {({left}: any) => <Kb.Box style={Styles.collapseStyles([styles.container, {left}])} />}
    </Kb.Animated>
  ))
}

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.red,
    height: 20,
    position: 'relative',
    width: 20,
  },
})

export default load
