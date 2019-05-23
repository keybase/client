import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import Success from './success'
import enterUsername from './enter-username/index.stories'

const load = () => {
  // Sub-component stories
  enterUsername()

  Sb.storiesOf('Profile/Generic Proofs', module).add('Success', () => {
    return (
      <Kb.Box style={styles.container}>
        <Success
          serviceIcon={[]}
          proofUsername={'cecileboucheron@boardgames.social'}
          onClose={Sb.action('onClose')}
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
