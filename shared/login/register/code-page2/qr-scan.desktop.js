// @flow
import * as React from 'react'
import {Box2, Text} from '../../../common-adapters'
import {globalColors} from '../../../styles'
const QRScan = () => (
  <Box2
    direction="vertical"
    style={{
      backgroundColor: globalColors.black,
      height: 200,
      justifyContent: 'center',
      width: 200,
    }}
  >
    <Text type="Body" backgroundMode="Terminal" style={{textAlign: 'center'}}>
      Not supported on desktop
    </Text>
  </Box2>
)
export default QRScan
