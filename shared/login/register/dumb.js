// @flow
import type {DumbComponentMap} from '../../constants/types/more'
import Passphrase from './passphrase/dumb'
import PaperKey from './paper-key/dumb'
import CodePage from './code-page/dumb'
import ErrorView from './error/dumb'
import SetPublicName from './set-public-name'
import SelectOtherDevice from './select-other-device'

const log = prefix => (...args) => console.log(prefix, ...args)

const setPublicNameMock = {
  onBack: log('onBack'),
  onChange: log('onChange'),
  onSubmit: log('onSubmit'),
  deviceName: 'MobilePhone',
  deviceNameError: null,
  submitEnabled: true,
  waiting: false,
  existingDevices: [],
}

const setPublicNameMap: DumbComponentMap<SetPublicName> = {
  component: SetPublicName,
  mocks: {
    Normal: setPublicNameMock,
    Error: {...setPublicNameMock, deviceNameError: 'Name taken'},
  },
}

const mockDevices = [
  ['iphone', 'mobile'],
  ['Home Computer', 'desktop'],
  ['Android Nexus 5x', 'mobile'],
].map(([name, type], i) => ({
  name,
  deviceID: i.toString(),
  type,
  created: 0,
  currentDevice: false,
  provisioner: null,
  provisionedAt: 0,
  revokedAt: null,
  lastUsed: 1,
}))

const selectOtherMock = {
  devices: mockDevices,
  onSelect: log('onSelect'),
  onWont: log('onWont'),
  onBack: log('onBack'),
}

const selectOtherDeviceMap: DumbComponentMap<SelectOtherDevice> = {
  component: SelectOtherDevice,
  mocks: {
    Normal: selectOtherMock,
  },
}

export default {
  Passphrase,
  PaperKey,
  CodePage,
  ErrorView,
  SetPublicName: setPublicNameMap,
  SelectOtherDevice: selectOtherDeviceMap,
}
