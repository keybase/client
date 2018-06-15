// @flow
import * as React from 'react'
import CodePage2 from '.'
import {action, storiesOf} from '../../../stories/storybook'

const textCode = 'scrub disagree sheriff holiday cabin habit mushroom member four'

const props = {
  textCode,
  textCodeInstructions: ',w',
  qrCode: qrGenerate(textCode),
  qrCodeInstructions: '',
}

const load = () => {
  storiesOf('Register/CodePage2', module).add('Scan Code (Mobile)', () => <CodePage2 {...props} />)
}

export default load
