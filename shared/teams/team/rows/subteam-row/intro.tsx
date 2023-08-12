import * as C from '../../../../constants'
import * as React from 'react'
import * as Constants from '../../../../constants/teams'
import * as ConfigConstants from '../../../../constants/config'
import {Box, Icon, Text} from '../../../../common-adapters'
import {styleSheetCreate, platformStyles, globalColors, globalMargins, globalStyles} from '../../../../styles'
import type {TeamID} from '../../../../constants/types/teams'

export type Props = {
  teamID: TeamID
}

const Banner = ({teamID}: Props) => {
  const teamname = C.useTeamsState(s => Constants.getTeamMeta(s, teamID).teamname)
  const shouldRender = C.useTeamsState(s => !s.sawSubteamsBanner)
  const updateGregorCategory = ConfigConstants.useConfigState(s => s.dispatch.updateGregorCategory)
  const onHide = React.useCallback(
    () => updateGregorCategory('sawSubteamsBanner', 'true'),
    [updateGregorCategory]
  )
  if (!shouldRender) {
    return null
  }
  return (
    <Box style={styles.containerBanner}>
      <Box style={styles.containerIllustration}>
        <Icon type="icon-illustration-subteams-380" />
      </Box>

      <Box style={styles.containerText}>
        <Text negative={true} type="BodySmallSemibold" style={styles.text}>
          Subteams are cryptographically distinct, and can welcome people who aren't elsewhere in your team
          hierarchy. Some random ideas:
        </Text>
        <Text negative={true} type="BodySmallSemibold">
          • {teamname}
          .devops
        </Text>
        <Text negative={true} type="BodySmallSemibold">
          • {teamname}
          .legal
        </Text>
        <Text negative={true} type="BodySmallSemibold">
          • {teamname}
          .customers.vip
        </Text>

        <Text
          negative={true}
          type="BodySmallSemiboldPrimaryLink"
          className="underline"
          onClickURL="https://keybase.io/docs/teams/design"
          style={styles.readmore}
        >
          Read more about subteams
        </Text>
      </Box>
      <Box style={styles.iconCloseContainer}>
        <Icon type="iconfont-close" style={{padding: globalMargins.tiny}} onClick={onHide} />
      </Box>
    </Box>
  )
}

const styles = styleSheetCreate(() => ({
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
    common: {...globalStyles.flexBoxColumn},
    isElectron: {
      marginLeft: globalMargins.medium,
      maxWidth: 330,
      paddingRight: globalMargins.small,
    },
    isMobile: {alignItems: 'center'},
  }),
  iconClose: {padding: globalMargins.tiny},
  iconCloseContainer: platformStyles({
    common: {position: 'absolute'},
    isElectron: {
      right: globalMargins.tiny,
      top: globalMargins.tiny,
    },
    isMobile: {
      right: globalMargins.small,
      top: globalMargins.small,
    },
  }),

  readmore: {
    marginTop: globalMargins.small,
  },
  text: platformStyles({
    common: {marginBottom: globalMargins.small},
    isMobile: {textAlign: 'center'},
  }),
}))

export default Banner
