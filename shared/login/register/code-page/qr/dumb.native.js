// @flow
import QR from './index'
import {globalStyles} from '../../../../styles'

import type {DumbComponentMap} from '../../../../constants/types/more'

const map: DumbComponentMap<QR> = {
  component: QR,
  mocks: {
    Normal: {
      parentProps: {
        style: {
          ...globalStyles.flexBoxColumn,
          flex: 1,
          minHeight: 500,
        },
      },
      scanning: true,
      onBarCodeRead: data => console.log('scanned data:', data),
      qrCode: '',
    },
  },
}

export default {
  QR: map,
}
