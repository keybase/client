// @flow
import * as React from 'react'
import {Box, Icon, Text} from '../../../../common-adapters'
import {styleSheetCreate, platformStyles, globalColors, globalMargins, globalStyles} from '../../../../styles'
import type {Teamname} from '../../../../constants/types/teams'

export type Props = {
  onReadMore: () => void,
  onHideSubteamsBanner: () => void,
  teamname: Teamname,
}

const Banner = ({onReadMore, onHideSubteamsBanner, teamname}: Props) => (
  <Box style={styles.containerBanner}>
    <Box style={styles.containerIllustration}>
      <Icon type="icon-illustration-subteams-380" />
    </Box>

    <Box style={styles.containerText}>
      <Text backgroundMode="Terminal" type="BodySmallSemibold" style={styles.text}>
        Subteams are cryptographically distinct, and can welcome people who aren't elsewhere in your team
        hierarchy. Some random ideas:
      </Text>
      <Text backgroundMode="Terminal" type="BodySmallSemibold">
        • {teamname}.devops
      </Text>
      <Text backgroundMode="Terminal" type="BodySmallSemibold">
        • {teamname}.legal
      </Text>
      <Text backgroundMode="Terminal" type="BodySmallSemibold">
        • {teamname}.customers.vip
      </Text>

      <Text
        backgroundMode="Terminal"
        type="BodySmallSemiboldPrimaryLink"
        className="underline"
        onClick={onReadMore}
        style={styles.readmore}
      >
        Read more about subteams
      </Text>
    </Box>
    {onHideSubteamsBanner && (
      <Box style={styles.iconCloseContainer}>
        <Icon type="iconfont-close" style={{padding: globalMargins.tiny}} onClick={onHideSubteamsBanner} />
      </Box>
    )}
  </Box>
)

const styles = styleSheetCreate({
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
      height: 256,
    },
    isMobile: {
      ...globalStyles.flexBoxColumn,
      padding: 24,
    },
  }),
  containerIllustration: {
    ...globalStyles.flexBoxColumn,
    margin: globalMargins.small,
  },
  containerText: platformStyles({
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
  text: platformStyles({
    common: {
      marginBottom: globalMargins.small,
    },
    isMobile: {
      textAlign: 'center',
    },
  }),
  readmore: {
    marginTop: globalMargins.small,
  },

  iconCloseContainer: platformStyles({
    common: {
      position: 'absolute',
    },
    isElectron: {
      right: globalMargins.tiny,
      top: globalMargins.tiny,
    },
    isMobile: {
      right: globalMargins.small,
      top: globalMargins.small,
    },
  }),
  iconClose: {
    padding: globalMargins.tiny,
  },
})

export default Banner
