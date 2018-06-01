// @flow
import * as React from 'react'
import Box from './box'
import {storiesOf} from '../stories/storybook'
import CopyText from './copy-text'

const load = () => {
  storiesOf('Common/Copy text', module)
    .addDecorator(story => (
      <Box style={{display: 'flex', flexDirection: 'row', maxWidth: 400, padding: 20, paddingTop: 50}}>
        {story()}
      </Box>
    ))
    .add('Basic', () => <CopyText text="hi" />)
    .add('With reveal', () => <CopyText text="surprise!" withReveal={true} />)
    .add('With long text', () => (
      <CopyText
        text="A9IOP56321387YRTPIQSDTAEA9IOP56321A9IOP56321387YRTPIQSDTAEA9IOP56321"
        withReveal={true}
      />
    ))
}

export default load
