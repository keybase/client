// @flow
import * as React from 'react'
import * as Constants from '../../constants/teams'
import * as Types from '../../constants/types/teams'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {Avatar, Button, ButtonBar, Box, Icon, Meta, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'
import TeamTabs from './tabs'
import Members from './members/container'
import Subteams from './subteams/container'
import Invites from './invites/container'
import Settings from './settings/container'
import RenderList from './list.render'

type AddYourselfRow = {
  type: 'add yourself',
  onAddSelf: () => void,
}

type SummaryRow = {
  type: 'summary',
  teamname: Types.Teamname,
  openTeam: boolean,
  role: ?Types.TeamRoleType,
  memberCount: number,
}

type DescriptionRow = {
  type: 'description',
  description: ?string,
  canEdit: boolean,
  onEditDescription: () => void,
}

type ActionRow = {
  type: 'action',
  onAddPeople: () => void,
  onInviteByEmail: () => void,
}

type HelpRow = {
  type: 'help',
}

type TabsRow = {
  type: 'tabs',
  admin: boolean,
  memberCount: number,
  teamname: Types.Teamname,
  newTeamRequests: Array<Types.Teamname>,
  numInvites: number,
  numRequests: number,
  numSubteams: number,
  loading?: boolean,
  selectedTab?: string,
  setSelectedTab: (?Types.TabKey) => void,
  yourOperations: RPCTypes.TeamOperation,
}

type MembersRow = {
  type: 'members',
  teamname: Types.Teamname,
}

type SubteamsRow = {
  type: 'subteams',
  teamname: Types.Teamname,
}

type InvitesRow = {
  type: 'invites',
  teamname: Types.Teamname,
}

type SettingsRow = {
  type: 'settings',
  teamname: Types.Teamname,
}

type TeamRow =
  | AddYourselfRow
  | SummaryRow
  | DescriptionRow
  | ActionRow
  | HelpRow
  | TabsRow
  | MembersRow
  | SubteamsRow
  | InvitesRow
  | SettingsRow

type TeamRows = Array<TeamRow>

const renderRow = (index: number, row: TeamRow) => {
  switch (row.type) {
    case 'add yourself': {
      return (
        <Box key="add yourself" style={stylesAddYourselfBanner}>
          <Text type="BodySemibold" style={stylesAddYourselfBannerText}>
            You are not a member of this team.
          </Text>
          <Text
            backgroundMode="Information"
            type="BodySemiboldLink"
            style={stylesAddYourselfBannerText}
            onClick={row.onAddSelf}
            underline={true}
          >
            Add yourself
          </Text>
        </Box>
      )
    }
    case 'summary': {
      return (
        <Box key="summary" style={stylesTeamHeader}>
          <Avatar isTeam={true} teamname={row.teamname} size={64} />
          <Text type="HeaderBig" selectable={true} style={{marginTop: globalMargins.tiny}}>
            {row.teamname}
          </Text>
          <Box style={globalStyles.flexBoxRow}>
            <Text type="BodySmall">TEAM</Text>
            {row.openTeam && <Meta style={stylesMeta} title="OPEN" />}
          </Box>
          <Text type="BodySmall">
            {row.memberCount + ' member' + (row.memberCount !== 1 ? 's' : '')} •{' '}
            {row.role && Constants.typeToLabel[row.role]}
          </Text>
        </Box>
      )
    }
    case 'description': {
      return (
        <Box key="description" style={stylesTeamHeader}>
          {!row.loading && (row.canEdit || row.description) ? (
            <Text
              style={{
                paddingTop: globalMargins.tiny,
                color: row.description ? globalColors.black_75 : globalColors.black_20,
                maxWidth: 560,
              }}
              onClick={row.canEdit ? row.onEditDescription : null}
              type={row.canEdit ? 'BodySecondaryLink' : 'Body'}
            >
              {row.description || (row.canEdit && 'Write a brief description')}
            </Text>
          ) : (
            <Box />
          )}
        </Box>
      )
    }
    case 'action': {
      return (
        <Box key="action" style={stylesTeamHeader}>
          <ButtonBar>
            <Button type="Primary" label="Add people" onClick={row.onAddPeople} />
            {!isMobile && <Button type="Secondary" label="Invite by email" onClick={row.onInviteByEmail} />}
            {isMobile && <Button type="Secondary" label="Invite contacts" onClick={row.onInviteByEmail} />}
          </ButtonBar>
        </Box>
      )
    }
    case 'help': {
      return (
        <Box key="help" style={{...globalStyles.flexBoxColumn, alignItems: 'center', margin: 20}}>
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
      )
    }
    case 'tabs': {
      return <TeamTabs key="tabs" {...row} />
    }
    case 'members': {
      return <Members key="members" teamname={row.teamname} />
    }
    case 'subteams': {
      return <Subteams key="subteams" teamname={row.teamname} />
    }
    case 'invites': {
      return <Invites key="invites" teamname={row.teamname} />
    }
    case 'settings': {
      return <Settings key="settings" teamname={row.teamname} />
    }
    default: {
      // eslint-disable-next-line no-unused-expressions
      ;(row.type: empty)
      throw new Error(`Impossible case encountered in team page list: ${row.type}`)
    }
  }
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
}

const stylesMeta = {
  alignSelf: 'center',
  backgroundColor: globalColors.green,
  borderRadius: 1,
  marginLeft: globalMargins.tiny,
  marginTop: 1,
}

type Props = {
  rows: TeamRows,
}

export type {TeamRow, TeamRows}
export default (props: Props) => <RenderList rows={props.rows} renderRow={renderRow} />
