import * as React from 'react'
import * as Sb from '../../stories/storybook'
import {Question1, Question2} from '.'

const props = {
  initialVerificationType: 'in_person',
  onBack: Sb.action('onBack'),
  onSubmit: Sb.action('onSubmit'),
  proofs: [
    {key: 'twitter', value: 'cecileboucheron'},
    {key: 'reddit', value: 'cecileboucheron'},
    {key: 'pgp', value: '75BHEBEGEBES'},
    {key: 'web', value: 'web.site'},
  ],
  voucheeUsername: 'weijiekohyalenus',
}

const errorProps = {
  error: 'You are offline.',
}

const load = () => {
  Sb.storiesOf('Profile/WotAuthor', module)
    .addDecorator(Sb.createPropProviderWithCommon())
    .add('Question1', () => <Question1 {...props} />)
    .add('Question2', () => <Question2 {...props} />)
    .add('Question1 error', () => <Question1 {...props} {...errorProps} />)
    .add('Question2 error', () => <Question2 {...props} {...errorProps} />)
    .add('Question2 spinning', () => <Question2 {...props} waiting={true} />)
}

export default load
