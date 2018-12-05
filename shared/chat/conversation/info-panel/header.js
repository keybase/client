// @flow
import * as React from 'react'
import {
  Box,
  Box2,
  ClickableBox,
  Icon,
  Markdown,
  ConnectedNameWithIcon,
  Text,
  iconCastPlatformStyles,
  type OverlayParentProps,
  OverlayParentHOC,
} from '../../../common-adapters'
import InfoPanelMenu from './menu/container'
import {
  glamorous,
  globalMargins,
  globalStyles,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../../styles'

type SmallProps = {
  teamname: string,
  participantCount: number,
  isSmallTeam: boolean,
} & OverlayParentProps

const gearIconSize = isMobile ? 24 : 16

const _SmallTeamHeader = (props: SmallProps) => {
  return (
    <Box style={styles.smallContainer}>
      <InfoPanelMenu
        attachTo={props.getAttachmentRef}
        onHidden={props.toggleShowingMenu}
        isSmallTeam={props.isSmallTeam}
        teamname={props.teamname}
        visible={props.showingMenu}
      />
      <ConnectedNameWithIcon
        containerStyle={styles.flexOne}
        horizontal={true}
        teamname={props.teamname}
        onClick="profile"
        title={props.teamname}
        metaOne={props.participantCount.toString() + ' member' + (props.participantCount !== 1 ? 's' : '')}
      />
      <Icon
        type="iconfont-gear"
        onClick={props.toggleShowingMenu}
        ref={props.setAttachmentRef}
        style={iconCastPlatformStyles(styles.gear)}
        fontSize={gearIconSize}
      />
    </Box>
  )
}
const SmallTeamHeader = OverlayParentHOC(_SmallTeamHeader)

// TODO probably factor this out into a connected component
type BigProps = {|
  canEditChannel: boolean,
  channelname: string,
  description: ?string,
  teamname: string,
  onEditChannel: () => void,
|}

type BigTeamHeaderProps = BigProps

const EditBox = isMobile
  ? ClickableBox
  : glamorous(ClickableBox)({
      '.header-row:hover &': {
        opacity: 1,
      },
      opacity: 0,
    })

const BigTeamHeader = (props: BigTeamHeaderProps) => {
  return (
    <Box2 direction={'vertical'} fullWidth={true} centerChildren={true} className="header-row">
      <Box style={styles.channelnameContainer}>
        <Text type="BodyBig">#{props.channelname}</Text>
        {props.canEditChannel && (
          <EditBox style={styles.editBox} onClick={props.onEditChannel}>
            <Icon style={iconCastPlatformStyles(styles.editIcon)} type="iconfont-edit" />
            <Text type="BodySmallPrimaryLink" className="hover-underline">
              Edit
            </Text>
          </EditBox>
        )}
      </Box>
      {!!props.description && <Markdown style={styles.description}>{props.description}</Markdown>}
    </Box2>
  )
}

const styles = styleSheetCreate({
  channelnameContainer: {
    alignSelf: 'center',
    marginBottom: 2,
    marginTop: globalMargins.medium,
    position: 'relative',
  },
  description: {
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
    textAlign: 'center',
  },
  editBox: {
    ...globalStyles.flexBoxRow,
    position: 'absolute',
    right: -50,
    top: isMobile ? 2 : 1,
  },
  editIcon: {marginRight: globalMargins.xtiny},
  flexOne: {flex: 1},
  gear: platformStyles({
    common: {
      height: gearIconSize,
      paddingLeft: 16,
      paddingRight: 16,
      width: gearIconSize,
    },
    isMobile: {
      marginRight: 16,
      width: gearIconSize + 32,
    },
  }),
  smallContainer: {
    ...globalStyles.flexBoxRow,
    alignItems: 'center',
    marginLeft: globalMargins.small,
  },
})

export {SmallTeamHeader, BigTeamHeader}
