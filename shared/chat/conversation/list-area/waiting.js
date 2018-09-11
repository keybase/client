// @flow
import * as React from 'react'
import {Box2, ProgressIndicator} from '../../../common-adapters'
import {styleSheetCreate} from '../../../styles'

const Waiting = () => (
  <Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
    <ProgressIndicator type="Small" style={styles.spinner} />
  </Box2>
)
const styles = styleSheetCreate({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  spinner: {width: 40},
})

export default Waiting
