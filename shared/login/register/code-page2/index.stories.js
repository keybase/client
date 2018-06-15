// @flow
import * as React from 'react'
import CodePage from '.'
import {action, storiesOf} from '../../../stories/storybook'
import {
  qrGenerate,
  codePageDeviceRoleExistingPhone,
  codePageDeviceRoleExistingComputer,
} from '../../../constants/login'

const props = {
  cameraBrokenMode: false,
  enterCodeErrorText: '',
  enterText: 'Foo Enter Text',
  mode: 'codePageModeScanCode',
  myDeviceRole: 'codePageDeviceRoleNewPhone',
  onBack: action('onBack'),
  onChangeText: action('onChangeText'),
  onKeyDown: action('onKeyDown'),
  qrCode: qrGenerate('derive jump shop federal'),
  qrCodeScanned: false,
  qrScanned: action('qrScanned'),
  resetQRCodeScanned: action('resetQRCodeScanned'),
  setCameraBrokenMode: action('setCameraBrokenMode'),
  setCodePageMode: action('setCodePageMode'),
  textCode: 'derive jump shop federal member moral clip prevent vast wear critic purple mistake',
  textEntered: action('textEntered'),
}

const load = () => {
  storiesOf('Register/CodePage', module)
    .add('Scan Code (Mobile)', () => (
      <CodePage {...props} mode={'codePageModeScanCode'} otherDeviceRole={codePageDeviceRoleExistingPhone} />
    ))
    .add('Scanned Code (Mobile)', () => (
      <CodePage
        {...props}
        mode={'codePageModeScanCode'}
        otherDeviceRole={codePageDeviceRoleExistingPhone}
        myDeviceRole={codePageDeviceRoleExistingPhone}
        qrCodeScanned={true}
      />
    ))
    .add('Show Text (Mobile)', () => (
      <CodePage {...props} mode={'codePageModeShowText'} otherDeviceRole={codePageDeviceRoleExistingPhone} />
    ))
    .add('Enter Text (Mobile)', () => (
      <CodePage {...props} mode={'codePageModeEnterText'} otherDeviceRole={codePageDeviceRoleExistingPhone} />
    ))
    .add('Show Code (Mobile)', () => (
      <CodePage {...props} mode={'codePageModeShowCode'} otherDeviceRole={codePageDeviceRoleExistingPhone} />
    ))
    .add('Show Text', () => (
      <CodePage
        {...props}
        mode={'codePageModeShowText'}
        otherDeviceRole={codePageDeviceRoleExistingComputer}
      />
    ))
    .add('Enter Text', () => (
      <CodePage
        {...props}
        mode={'codePageModeEnterText'}
        otherDeviceRole={codePageDeviceRoleExistingComputer}
      />
    ))
    .add('Show Code', () => (
      <CodePage
        {...props}
        mode={'codePageModeShowCode'}
        otherDeviceRole={codePageDeviceRoleExistingComputer}
      />
    ))
    .add('Scan Code', () => (
      <CodePage
        {...props}
        mode={'codePageModeScanCode'}
        otherDeviceRole={codePageDeviceRoleExistingComputer}
      />
    ))
}

export default load
