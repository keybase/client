// @flow
import * as React from 'react'
import {storiesOf} from '../../../../stories/storybook'
import RetentionPicker from '.'

const load = () => {
  storiesOf('Chat/Teams/Retention').add('Dropdown', () => <RetentionPicker />)
}

export default load
