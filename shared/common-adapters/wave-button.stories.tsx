import {Box2} from './box'
import WaveButton from './wave-button'
import * as React from 'react'
import * as Sb from '../stories/storybook'

const load = () => {
  Sb.storiesOf('Common', module).add('Wave Button', () => (
    <Box2 direction="horizontal" gap="small" gapStart={true} gapEnd={true}>
      <WaveButton username="chris" />
      <WaveButton username="chris" toMany={true} />
      <WaveButton username="chris" small={true} />
      <WaveButton username="chris" toMany={true} small={true} />
      <WaveButton username="chris" toMany={true} small={true} />
    </Box2>
  ))
}

export default load
