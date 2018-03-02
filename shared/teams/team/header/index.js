// @flow
import * as React from 'react'
import * as Constants from '../../../constants/teams'
import * as Types from '../../../constants/types/teams'
import {Avatar, Box, Button, ButtonBar, Icon, Meta, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../styles'

export type Props = {
  canEditDescription: boolean,
  canJoinTeam: boolean,
  canManageMembers: boolean,
  description: ?string,
  memberCount: number,
  openTeam: boolean,
  role: ?Types.TeamRoleType,
  teamname: string,

  onAddPeople: (target?: any) => void,
  onAddSelf: () => void,
  onChat: () => void,
  onEditDescription: () => void,
}

const TeamHeader = (props: Props) => (
  <Box style={stylesContainer}>
    {props.canJoinTeam && (
      <Box key="add yourself" style={stylesAddYourselfBanner}>
        <Text type="BodySemibold" style={stylesAddYourselfBannerText}>
          You are not a member of this team.
        </Text>
        <Text
          backgroundMode="Information"
          type="BodySemiboldLink"
          style={stylesAddYourselfBannerText}
          onClick={props.onAddSelf}
          underline={true}
        >
          Add yourself
        </Text>
      </Box>
    )}
    <Box style={stylesTeamHeader}>
      {/* Summary */}
      <Avatar isTeam={true} teamname={props.teamname} size={64} />
      <Text type="HeaderBig" selectable={true} style={{marginTop: globalMargins.tiny}}>
        {props.teamname}
      </Text>
      <Box style={globalStyles.flexBoxRow}>
        <Text type="BodySmall">TEAM</Text>
        {props.openTeam && <Meta style={stylesMeta} title="OPEN" />}
      </Box>
      <Text type="BodySmall">
        {props.memberCount + ' member' + (props.memberCount !== 1 ? 's' : '')} •{' '}
        {props.role && Constants.typeToLabel[props.role]}
      </Text>

      {/* Description */}
      {!props.loading && (props.canEditDescription || props.description) ? (
        <Text
          style={{
            paddingTop: globalMargins.tiny,
            color: props.description ? globalColors.black_75 : globalColors.black_20,
            maxWidth: 560,
          }}
          onClick={props.canEditDescription ? props.onEditDescription : null}
          type={props.canEditDescription ? 'BodySecondaryLink' : 'Body'}
        >
          {props.description || (props.canEditDescription && 'Write a brief description')}
        </Text>
      ) : (
        <Box />
      )}

      {/* Actions */}
      <ButtonBar direction="row" style={isMobile ? {width: 'auto', marginBottom: -8} : undefined}>
        <Button type="Primary" label="Chat" onClick={props.onChat}>
          <Icon
            type="iconfont-chat"
            style={{
              marginRight: 8,
              color: globalColors.white,
            }}
          />
        </Button>
        {props.canManageMembers && (
          <Button
            type="Secondary"
            label={'Add people...'}
            onClick={event => props.onAddPeople(isMobile ? undefined : event.target)}
          />
        )}
      </ButtonBar>

      {/* CLI hint */}
      {!isMobile && (
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', margin: 20}}>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', marginBottom: globalMargins.xtiny}}>
            <Box style={{backgroundColor: globalColors.black_05, height: 1, width: 24}} />
            <Icon
              style={{
                color: globalColors.black_10,
                paddingLeft: globalMargins.tiny,
                paddingRight: globalMargins.tiny,
              }}
              type="iconfont-info"
            />
            <Box style={{backgroundColor: globalColors.black_05, height: 1, width: 24}} />
          </Box>
          <Text type="BodySmall" style={{textAlign: 'center'}}>
            You can also manage teams from the terminal:
          </Text>
          <Text
            type="TerminalInline"
            selectable={true}
            style={{
              marginLeft: globalMargins.xtiny,
              marginTop: globalMargins.xtiny,
            }}
          >
            keybase team --help
          </Text>
        </Box>
      )}
    </Box>
  </Box>
)

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  width: '100%',
  height: '100%',
  position: 'relative',
}

const stylesAddYourselfBanner = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: 'stretch',
  backgroundColor: globalColors.blue,
  justifyContent: 'center',
  minHeight: 40,
  marginBottom: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
}

const stylesAddYourselfBannerText = {
  color: globalColors.white,
  textAlign: 'center',
}

const stylesTeamHeader = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  textAlign: 'center',
  paddingLeft: isMobile ? 0 : globalMargins.medium,
  paddingRight: isMobile ? 0 : globalMargins.medium,
  paddingTop: isMobile ? globalMargins.medium : globalMargins.tiny,
}

const stylesMeta = {
  alignSelf: 'center',
  backgroundColor: globalColors.green,
  borderRadius: 1,
  marginLeft: globalMargins.tiny,
  marginTop: 1,
}

export {TeamHeader}
