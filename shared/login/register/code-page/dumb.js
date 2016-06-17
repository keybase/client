// @flow

import Render from './index.render'
import type {DumbComponentMap} from '../../../constants/types/more'

export type Mode = 'codePageModeScanCode' | 'codePageModeShowCode' | 'codePageModeEnterText' | 'codePageModeShowText'
const baseMock = {
  mode: 'codePageModeScanCode',
  textCode: 'go hammer go hammer go hammer go stop hammer time',
  qrCode: 'go hammer go hammer go hammer go stop hammer time',
  myDeviceRole: 'codePageDeviceRoleNewPhone',
  otherDeviceRole: 'codePageDeviceRoleExistingComputer',
  cameraBrokenMode: false,
  setCodePageMode: () => {},
  qrScanned: data => console.log('QR Scanned:', data),
  setCameraBrokenMode: () => {},
  textEntered: () => console.log('textEntered'),
  onChangeText: () => console.log('onChangeText'),
  onBack: () => console.log('onBack'),
  enterText: 'Foo Enter Text',
}

const dumbComponentMap: DumbComponentMap<Render> = {
  component: Render,
  mocks: {
    'Normal': baseMock,
  },
}

export default dumbComponentMap
