import * as I from 'immutable'
import * as DeviceTypes from './devices'
import HiddenString from '../../util/hidden-string'
import {RPCError} from '../../util/errors'

export type _Device = {
  id: DeviceTypes.DeviceID,
  name: string,
  type: DeviceTypes.DeviceType
};
export type Device = I.RecordOf<_Device>;

export type _State = {
  codePageOtherDeviceName: string,
  codePageOtherDeviceType: "mobile" | "desktop",
  codePageOtherDeviceId: string,
  codePageIncomingTextCode: HiddenString,
  codePageOutgoingTextCode: HiddenString,
  error: HiddenString,
  finalError: RPCError | null,
  inlineError: RPCError | null,
  usernameOrEmail: string,
  deviceName: string,
  devices: I.List<Device>,
  gpgImportError: string | null,
  existingDevices: I.List<string>
};

export type State = I.RecordOf<_State>;
