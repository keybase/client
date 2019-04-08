import * as React from 'react'
import * as Sb from '../stories/storybook'
import Placeholder from './placeholder'
import * as Styles from '../styles'
import Box from './box'

const load = () => {
  Sb.storiesOf('Common/Placeholder', module)
    .add('Default', () => (
      <Box>
        <Placeholder />
        <Placeholder />
        <Placeholder />
      </Box>
    ))
    .add('Customized', () => (
      <Box>
        <Placeholder
          width={256}
          style={{marginBottom: Styles.globalMargins.small, marginTop: Styles.globalMargins.small}}
        />
        <Placeholder
          width={256}
          style={{marginBottom: Styles.globalMargins.small, marginTop: Styles.globalMargins.small}}
        />
        <Placeholder
          width={256}
          style={{marginBottom: Styles.globalMargins.small, marginTop: Styles.globalMargins.small}}
        />
      </Box>
    ))
}

export default load
