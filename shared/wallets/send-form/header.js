// @flow
import * as React from 'react'
import {BackButton, Box2, Icon, iconCastPlatformStyles} from '../../common-adapters'
import {collapseStyles, globalColors, platformStyles, styleSheetCreate} from '../../styles'

type Props = {onBack?: () => void, whiteBackground?: boolean}

const Header = (props: Props) => (
  <Box2 direction="horizontal" style={styles.headerContainer} fullWidth={true}>
    <Box2
      direction="horizontal"
      style={collapseStyles([styles.header, props.whiteBackground && styles.whiteBackground])}
      fullWidth={true}
    >
      {props.onBack && <BackButton style={styles.backButton} onClick={props.onBack} />}
      <Icon type="icon-stellar-coins-flying-48" style={iconCastPlatformStyles(styles.icon)} />
    </Box2>
  </Box2>
)

const styles = styleSheetCreate({
  backButton: {
    bottom: 14,
    left: 16,
    position: 'absolute',
  },
  header: {
    alignSelf: 'flex-end',
    backgroundColor: globalColors.purple,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    height: 48,
    justifyContent: 'center',
    position: 'relative',
  },
  headerContainer: {
    height: 60,
  },
  icon: {
    position: 'relative',
    top: -9,
  },
  whiteBackground: platformStyles({
    common: {
      backgroundColor: globalColors.white,
      borderBottomColor: globalColors.black_05,
      borderBottomWidth: 2,
    },
    isElectron: {
      borderBottomStyle: 'solid',
      borderBottomWidth: '1px',
    },
  }),
})

export default Header
