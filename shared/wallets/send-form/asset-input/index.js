// @flow
import * as React from 'react'
import {Box2, Input2, Text} from '../../../common-adapters'
import {globalColors, styleSheetCreate} from '../../../styles'

type Props = {}

const AssetInput = (props: Props) => (
  <Box2 direction="vertical">
    <Input2
      decoration={
        <Box2 direction="vertical">
          <Text type="HeaderBigExtrabold">USD ($)</Text>
        </Box2>
      }
      textType="HeaderBigExtrabold"
      placeholder="0.0000000"
    />
  </Box2>
)

const styles = styleSheetCreate({
  text: {
    textAlign: 'center',
  },
})

export default AssetInput
