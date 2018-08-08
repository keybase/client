// @flow
import * as React from 'react'
import * as Sb from '../../../stories/storybook'
import {Box} from '../../../common-adapters'
import Participants from '.'

const provider = Sb.createPropProviderWithCommon({
  // TODO mock out meaningful values once type `OwnProps` is defined
  Participants: props => ({}),
})

const load = () => {
  const story = Sb.storiesOf('Wallets/SendForm/Participants', module).addDecorator(story => (
    <Box style={{maxWidth: 360}}>{story()}</Box>
  ))
  story.addDecorator(provider)
  story.add('Normal', () => <Participants incorrect={false} />)
  story.add('Address Error', () => (
    <Participants incorrect={true} />
  ))
  story.add('User match', () => (
    <Participants username="yen" fullname="Addie Stokes" onShowProfile={Sb.action('onShowProfile')} />
  ))
}

export default load
