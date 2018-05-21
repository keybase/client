// @flow
import * as React from 'react'
import {
  Box,
  ClickableBox,
  Icon,
  Markdown,
  NameWithIcon,
  Text,
  iconCastPlatformStyles,
} from '../../../common-adapters'
import {type FloatingMenuParentProps, FloatingMenuParentHOC} from '../../../common-adapters/floating-menu'
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
  onClick: () => void,
  isSmallTeam: boolean,
} & FloatingMenuParentProps

const gearIconSize = isMobile ? 24 : 16

const _SmallTeamHeader = (props: SmallProps) => {
  return (
    <Box style={styles.smallContainer}>
      <InfoPanelMenu
        attachTo={props.attachmentRef}
        onHidden={props.toggleShowingMenu}
        isSmallTeam={props.isSmallTeam}
        teamname={props.teamname}
        visible={props.showingMenu}
      />
      <NameWithIcon
        containerStyle={styles.flexOne}
        horizontal={true}
        teamname={props.teamname}
        onClick={props.onClick}
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
const SmallTeamHeader = FloatingMenuParentHOC(_SmallTeamHeader)

// TODO probably factor this out into a connected component
type BigProps = {
  canEditChannel: boolean,
  channelname: string,
  description: ?string,
  teamname: string,
  onClick: () => void,
  onEditChannel: () => void,
}

const EditBox = isMobile
  ? ClickableBox
  : glamorous(ClickableBox)({
      opacity: 0,
      '.header-row:hover &': {
        opacity: 1,
      },
    })

const BigTeamHeader = (props: BigProps) => {
  return (
    <Box className="header-row" style={styles.bigContainer}>
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
    </Box>
  )
}

const styles = styleSheetCreate({
  bigContainer: {...globalStyles.flexBoxColumn, alignItems: 'stretch'},
  channelnameContainer: {
    alignSelf: 'center',
    marginTop: globalMargins.medium,
    marginBottom: 2,
    position: 'relative',
  },
  description: {
    paddingLeft: 4,
    paddingRight: 4,
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
      paddingRight: 16,
      paddingLeft: 16,
      width: gearIconSize,
      height: gearIconSize,
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
