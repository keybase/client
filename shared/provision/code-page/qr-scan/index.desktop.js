// @flow
import * as React from 'react'
import {Box2, ProgressIndicator} from '../../../common-adapters'
import {globalColors, styleSheetCreate} from '../../../styles'
import QRScanLines from './lines'
import type {Props} from '.'
// Basically only used for storybook

const QRScan = (props: Props) => (
  <Box2 direction="vertical" style={styles.container}>
    <QRScanLines canScan={true} />
    {props.waiting && <ProgressIndicator style={styles.waiting} type="Large" white={true} />}
  </Box2>
)

const styles = styleSheetCreate({
  container: {
    alignSelf: 'stretch',
    backgroundColor: globalColors.black,
    height: 200,
    justifyContent: 'center',
    position: 'relative',
  },
  waiting: {
    alignSelf: 'center',
  },
})

export default QRScan
