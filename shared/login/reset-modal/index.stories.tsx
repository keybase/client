import * as React from 'react'
import * as Sb from '../../stories/storybook'
import ResetModal from '.'

const load = () => {
  Sb.storiesOf('Login/Reset account modal', module).add('Default state', () => (
    <ResetModal
      onCancelReset={Sb.action('onCancelReset')}
      timeLeft="2 days"
      mapURL="https://i.imgur.com/XwTVNzr.png"
    />
  ))
}

export default load
