import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Result from './result'
import enterUsername from './enter-username/index.stories'

const load = () => {
  // Sub-component stories
  enterUsername()

  Sb.storiesOf('Profile/Generic Proofs', module)
    .add('Result (success)', () => {
      return (
        <Kb.Box style={styles.container}>
          <Result
            serviceIcon={[]}
            proofUsername={'cecileboucheron@boardgames.social'}
            onClose={Sb.action('onClose')}
            errorText={''}
          />
        </Kb.Box>
      )
    })
    .add('Result (failure)', () => {
      return (
        <Kb.Box style={styles.container}>
          <Result
            serviceIcon={[]}
            proofUsername={'cecileboucheron@boardgames.social'}
            onClose={Sb.action('onClose')}
            errorText={'Timed out after looking for proof for 1h'}
          />
        </Kb.Box>
      )
    })
}

const styles = {
  container: Styles.platformStyles({
    isElectron: {
      borderStyle: 'solid',
      borderWidth: 1,
      height: 485,
      width: 560,
    },
  }),
}

export default load
