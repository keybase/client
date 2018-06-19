// @flow
import * as PropProviders from '../../../stories/prop-providers'
import * as React from 'react'
import CodePage2 from '.'
import {action, storiesOf} from '../../../stories/storybook'
import {qrGenerate} from '../../../constants/login'

const textCode = 'scrub disagree sheriff holiday cabin habit mushroom member four'

const props = {
  defaultMode: 'viewQR',
  enterQrCodeInstructions: 'Enter qr code instructions',
  enterTextCodeInstructions: 'Enter text code instructions',
  isValidLookingCode: value => value.split(' ').length === 12,
  onSubmitTextCode: action('onSubmitTextCode'),
  viewQrCode: qrGenerate(textCode),
  viewQrCodeInstructions:
    'View qr code instructions of some length that might explain what the user should be doing',
  viewTextCode: textCode,
  viewTextCodeInstructions: 'View text code instructions',
}

const load = () => {
  storiesOf('Register/CodePage2', module)
    .addDecorator(PropProviders.Common())
    .add('View QR', () => <CodePage2 {...props} />)
    .add('Scan QR', () => <CodePage2 {...props} defaultMode="scanQR" />)
    .add('Enter a text code', () => <CodePage2 {...props} defaultMode="enterText" />)
    .add('See a text code', () => <CodePage2 {...props} defaultMode="viewText" />)
}

export default load
