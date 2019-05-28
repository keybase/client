import * as React from 'react'
import {Box2, ProgressIndicator, QRLines} from '../../../common-adapters'
import {globalColors, styleSheetCreate} from '../../../styles'
import {Props} from '.'
// Basically only used for storybook

const QRScan = (props: Props) => (
  <Box2 direction="vertical" style={styles.container}>
    <QRLines canScan={true} />
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
