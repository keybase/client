// @flow
import * as React from 'react'
import * as Sb from '../stories/storybook'
import Box from './box'
import CopyText from './copy-text'

const load = () => {
  Sb.storiesOf('Common/Copy text', module)
    .addDecorator(story => (
      <Box style={{display: 'flex', flexDirection: 'row', maxWidth: 550, padding: 20, paddingTop: 50}}>
        {story()}
      </Box>
    ))
    .add('Basic', () => <CopyText text="hi" />)
    .add('Basic (multiline)', () => <CopyText multiline={true} text="hi" />)
    .add('With long text', () => (
      <CopyText text="A9IOP56321 387YRTPIQSDTAE A9IOP56321A 9IOP563213 87YRTPIQSDTAEA9IOP56321" />
    ))
    .add('With long text (multiline)', () => (
      <CopyText
        text="A9IOP56321 387YRTPIQSDTAE A9IOP56321A 9IOP563213 87YRTPIQSDTAEA9IOP56321"
        multiline={true}
      />
    ))
    .add('With reveal', () => <CopyText text="surprise!" withReveal={true} />)
    .add('With reveal (multiline)', () => <CopyText multiline={true} text="surprise!" withReveal={true} />)
    .add('With long text + reveal', () => (
      <CopyText
        text="A9IOP56321387YRTPIQSDTAEA9IOP56321A9IOP56321387YRTPIQSDTAEA9IOP56321"
        withReveal={true}
      />
    ))
    .add('With long text + reveal (multiline)', () => (
      <CopyText
        text="A9IOP56321387YRTPIQSDTAEA9IOP56321A9IOP56321387YRTPIQSDTAEA9IOP56321"
        multiline={true}
        withReveal={true}
      />
    ))
}

export default load
