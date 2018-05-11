// @flow
import * as React from 'react'
import {Box2, Icon} from '../../../common-adapters'
import {globalColors, styleSheetCreate} from '../../../styles'

type Props = {}

const Header = (props: Props) => (
  <Box2 direction="horizontal" style={styles.headerContainer} fullWidth={true}>
    <Box2 direction="horizontal" style={styles.header} fullWidth={true}>
      <Icon type="icon-stellar-coins-flying-48" style={styles.icon} />
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  header: {
    alignSelf: 'flex-end',
    backgroundColor: globalColors.purple,
    borderRadius: '4px 4px 0 0',
    height: 48,
    justifyContent: 'center',
  },
  headerContainer: {
    height: 60,
  },
  icon: {
    position: 'relative',
    top: -9,
  },
})

export default Header
