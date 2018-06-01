// @flow
import * as React from 'react'
import Box from './box'
import {storiesOf, action} from '../stories/storybook'
import CopyText from './copy-text'

const load = () => {
  storiesOf('Common/Copy text', module)
    .addDecorator(story => (
      <Box style={{display: 'flex', flexDirection: 'row', maxWidth: 400, padding: 20, paddingTop: 50}}>
        {story()}
      </Box>
    ))
    .add('Basic', () => <CopyText text="hi" />)
}

export default load
