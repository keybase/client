// @flow
import QR from './index'

import type {DumbComponentMap} from '../../../../constants/types/more'

const map: DumbComponentMap<QR> = {
  component: QR,
  mocks: {
    'Normal': {
      scanning: true,
      onBarCodeRead: data => console.log('scanned data:', data),
      qrCode: '',
    },
  },
}

export default {
  'QR': map,
}
