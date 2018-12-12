// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
// import

const load = () => {
  Sb.storiesOf('Common', module)
    .add('Reload', () => (
      return null
    ))
}

export default load
