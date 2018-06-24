// @flow
import * as React from 'react'
import {Box2, HeaderHocHeader} from '../../common-adapters'
import {styleSheetCreate, isMobile} from '../../styles'

type Props = {
  children: React.Node,
  onBack: () => void,
}

const Wrapper = (props: Props) => (
  <Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    <HeaderHocHeader onBack={props.onBack} headerStyle={styles.header} />
    <Box2
      direction="vertical"
      fullWidth={true}
      fullHeight={true}
      centerChildren={true}
      gap={isMobile ? 'xtiny' : 'small'}
    >
      {props.children}
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  header: {position: 'absolute'},
})

export default Wrapper
