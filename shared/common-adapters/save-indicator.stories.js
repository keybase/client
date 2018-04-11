// @flow
import * as React from 'react'
import SaveIndicator from './save-indicator'
import {storiesOf} from '../stories/storybook'

const load = () => {
  storiesOf('Common', module).add('SaveIndicator', () => <SaveIndicator saveState="justSaved" />)
}

export default load
