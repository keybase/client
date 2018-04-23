// @flow
import type {DumbComponentMap} from '../../constants/types/more'
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

export default {
  Passphrase,
  PaperKey,
  CodePage,
  ErrorView,
  SetPublicName: setPublicNameMap,
  SelectOtherDevice: selectOtherDeviceMap,
}
