// @flow
import * as React from 'react'
import {Box, Icon, Text} from '../../common-adapters'
import {
  styleSheetCreate,
  platformStyles,
  globalColors,
  globalMargins,
  globalStyles,
  isMobile,
} from '../../styles'

export type Props = {
  onReadMore: () => void,
  onHideChatBanner: () => void,
}

const Banner = ({onReadMore, onHideChatBanner}: Props) => (
  <Box style={styles.containerBanner}>
    <Icon type={isMobile ? 'icon-illustration-teams-216' : 'icon-illustration-teams-180'} />
    <Box style={styles.containerHeader}>
      <Text backgroundMode="Terminal" type="Header" style={styles.header}>
        Now supporting teams!
      </Text>
      <Text backgroundMode="Terminal" type="BodySmallSemibold" style={styles.text}>
        Keybase team chats are encrypted - unlike Slack - and work for any size group, from casual friends to
        large communities.
      </Text>
      <Text
        backgroundMode="Terminal"
        type="BodySmallSemiboldPrimaryLink"
        className="underline"
        onClick={onReadMore}
      >
        Read our announcement
      </Text>
    </Box>
    <Box style={styles.closeIconContainer}>
      <Icon type="iconfont-close" style={{padding: globalMargins.xtiny}} onClick={onHideChatBanner} />
    </Box>
  </Box>
)

const styles = styleSheetCreate({
  closeIcon: {
    padding: globalMargins.xtiny,
  },
  closeIconContainer: platformStyles({
    common: {
      position: 'absolute',
    },
    isElectron: {
      right: globalMargins.tiny,
      top: globalMargins.tiny,
    },
    isMobile: {
      height: 26,
      right: globalMargins.small,
      top: globalMargins.small,
      width: 26,
    },
  }),
  containerBanner: platformStyles({
    common: {
      alignItems: 'center',
      backgroundColor: globalColors.blue,
      flexShrink: 0,
      justifyContent: 'center',
      position: 'relative',
      width: '100%',
    },
    isElectron: {
      ...globalStyles.flexBoxRow,
      height: 212,
    },
    isMobile: {
      ...globalStyles.flexBoxColumn,
      padding: 24,
    },
  }),
  containerHeader: platformStyles({
    common: {
      ...globalStyles.flexBoxColumn,
    },
    isElectron: {
      marginLeft: globalMargins.medium,
      maxWidth: 330,
    },
    isMobile: {
      alignItems: 'center',
    },
  }),
  header: {
    marginBottom: 15,
    marginTop: 15,
  },
  text: platformStyles({
    common: {
      marginBottom: globalMargins.small,
    },
    isMobile: {
      textAlign: 'center',
    },
  }),
})

export default Banner
