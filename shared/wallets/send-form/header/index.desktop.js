// @flow
import * as React from 'react'
import {Box2, Icon, iconCastPlatformStyles} from '../../../common-adapters'
import {globalColors, styleSheetCreate} from '../../../styles'

type Props = {}

const Header = (props: Props) => (
  <Box2 direction="horizontal" style={styles.headerContainer} fullWidth={true}>
    <Box2 direction="horizontal" style={styles.header} fullWidth={true}>
      <Icon type="icon-stellar-coins-flying-48" style={iconCastPlatformStyles(styles.icon)} />
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  header: {
    alignSelf: 'flex-end',
    backgroundColor: globalColors.purple,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
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
