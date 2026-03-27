import * as Z from '@/util/zustand'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'

type Store = {
  actionEnabled: boolean
  actionWaiting: boolean
  botInTeam: boolean
  botReadOnly: boolean
  botSubScreen: '' | 'install' | 'channels'
  data: unknown
  deviceBadges: Set<T.Devices.DeviceID>
  editAvatarHasImage: boolean
  onAction: (() => void) | undefined
  title: string
}

const initialStore: Store = {
  actionEnabled: false,
  actionWaiting: false,
  botInTeam: false,
  botReadOnly: false,
  botSubScreen: '',
  data: undefined,
  deviceBadges: new Set(),
  editAvatarHasImage: false,
  onAction: undefined,
  title: '',
}

export type State = Store & {
  dispatch: {
    clearDeviceBadges: () => void
    resetState: () => void
    setDeviceBadges: (deviceBadges: Set<T.Devices.DeviceID>) => void
  }
}

export const useModalHeaderState = Z.createZustand<State>('modal-header', set => {
  const dispatch: State['dispatch'] = {
    clearDeviceBadges: () => {
      ignorePromise(T.RPCGen.deviceDismissDeviceChangeNotificationsRpcPromise())
      set(s => {
        s.deviceBadges = new Set()
      })
    },
    resetState: Z.defaultReset,
    setDeviceBadges: deviceBadges => {
      set(s => {
        s.deviceBadges = new Set(deviceBadges)
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
