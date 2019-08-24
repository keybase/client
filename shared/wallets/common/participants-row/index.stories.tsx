import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import ParticipantsRow from '.'

const load = () => {
  Sb.storiesOf('Wallets/Common/Participants Row', module)
    .add('To heading', () => <ParticipantsRow heading="To" />)
    .add('From heading with a divider and right aligned', () => (
      <ParticipantsRow heading="From" bottomDivider={true} headingAlignment="Right" />
    ))
}

export default load
