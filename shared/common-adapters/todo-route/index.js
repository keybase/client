// @flow
import * as React from 'react'
import {HeaderHocHeader} from '../header-hoc'
import {Box2} from '../box'
import Text from '../text'

type Props = {
  onBack: () => void,
}

const TODORoute = (props: Props) => (
  <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <HeaderHocHeader onBack={props.onBack} title="T O D O" />
    <Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
      <Text type="HeaderExtrabold" style={{textAlign: 'center'}}>
        Nothing to see here...
      </Text>
    </Box2>
  </Box2>
)

export default TODORoute
