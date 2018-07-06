// @flow
import * as React from 'react'
import {Box2} from '../../../common-adapters'
import {globalColors} from '../../../styles'
import QRScanLines from './qr-scan-lines'

// Basically only used for storybook

const QRScan = () => (
  <Box2
    direction="vertical"
    style={{
      alignSelf: 'stretch',
      backgroundColor: globalColors.black,
      height: 200,
      position: 'relative',
    }}
  >
    <QRScanLines canScan={true} />
  </Box2>
)
export default QRScan
