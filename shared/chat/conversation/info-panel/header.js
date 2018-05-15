// @flow
import * as React from 'react'
import {Box, ClickableBox, Icon, NameWithIcon, Text} from '../../../common-adapters'
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
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        marginLeft: globalMargins.small,
      }}
    >
      <InfoPanelMenu
        attachTo={props.attachmentRef}
        onHidden={props.toggleShowingMenu}
        isSmallTeam={props.isSmallTeam}
        teamname={props.teamname}
        visible={props.showingMenu}
      />
      <NameWithIcon
        containerStyle={{flex: 1}}
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
        style={iconStyle}
        fontSize={gearIconSize}
      />
    </Box>
  )
}

const iconStyle = platformStyles({
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
})

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
    <Box className="header-row" style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
      <Box
        style={{alignSelf: 'center', marginTop: globalMargins.medium, marginBottom: 2, position: 'relative'}}
      >
        <Text type="BodyBig">#{props.channelname}</Text>
        {props.canEditChannel && (
          <EditBox
            style={{
              ...globalStyles.flexBoxRow,
              position: 'absolute',
              right: -50,
              top: isMobile ? 2 : 1,
            }}
            onClick={props.onEditChannel}
          >
            <Icon style={{marginRight: globalMargins.xtiny}} type="iconfont-edit" />
            <Text type="BodySmallPrimaryLink" className="hover-underline">
              Edit
            </Text>
          </EditBox>
        )}
      </Box>
      {!!props.description && (
        <Text style={styles.description} type="Body">
          {props.description}
        </Text>
      )}
    </Box>
  )
}

const styles = styleSheetCreate({
  description: platformStyles({
    common: {
      paddingLeft: 4,
      paddingRight: 4,
      textAlign: 'center',
    },
    isElectron: {
      wordWrap: 'break-word',
    },
  }),
})

export {SmallTeamHeader, BigTeamHeader}
