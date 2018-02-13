// @flow
import * as React from 'react'
import {Box, Button, ButtonBar, Divider, HeaderHoc, List, Text} from '../../../common-adapters'
import {type Props as HeaderHocProps} from '../../../common-adapters/header-hoc'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../styles'
import {SmallTeamHeader, BigTeamHeader} from './header'
import Notifications from './notifications/container'
import {Participant, type ParticipantInfo} from './participant'
import {ManageTeam} from './manage-team'
import {TurnIntoTeam} from './turn-into-team'

const border = `1px solid ${globalColors.black_05}`
const listStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  paddingBottom: globalMargins.medium,
  flex: 1,
  ...(isMobile
    ? {}
    : {
        backgroundColor: globalColors.white,
        borderLeft: border,
        borderRight: border,
        marginTop: -1 /* Necessary fix: adds 1px at the top so we hide the gray divider */,
      }),
}

type InfoPanelProps = {
  participants: Array<ParticipantInfo>,
  isPreview: boolean,
  teamname: ?string,
  channelname: ?string,
  smallTeam: boolean,
  admin: boolean,

  // Used by HeaderHoc.
  onBack: () => void,

  // Used by Participant.
  onShowProfile: (username: string) => void,

  // Used by the conversation case.
  onShowBlockConversationDialog: () => void,
  onShowNewTeamDialog: () => void,

  // Used by {Small,Big}HeaderRow.
  onViewTeam: () => void,

  // Used by BigHeaderRow.
  onLeaveConversation: () => void,
  onJoinChannel: () => void,
} & HeaderHocProps

type BigHeaderRow = {
  type: 'big header',
  key: 'BIG HEADER',

  isPreview: boolean,
  teamname: string,
  channelname: string,
  admin: boolean,
  participantCount: number,

  onViewTeam: () => void,
  onLeaveConversation: () => void,
  onJoinChannel: () => void,
}

type ParticipantRow = ParticipantInfo & {
  type: 'participant',
  key: string,

  onShowProfile: string => void,
}

type DividerRow = {
  type: 'divider',
  key: string,
  marginTop?: number,
  marginBottom?: number,
}

type TurnIntoTeamRow = {
  type: 'turn into team',
  onShowNewTeamDialog: () => void,
}

type NotificationsRow = {
  type: 'notifications',
}

type BlockThisConversationRow = {
  type: 'block this conversation',
  onShowBlockConversationDialog: () => void,
}

type SmallTeamHeaderRow = {
  type: 'small team header',
  teamname: string,
  participantCount: number,
  onViewTeam: () => void,
}

type ManageTeamRow = {
  type: 'manage team',
  canManage: boolean,
  label: string,
  participantCount: number,
  onViewTeam: () => void,
}

type BigTeamHeaderRow = {
  type: 'big team header',
  teamname: string,
  channelname: string,
  onViewTeam: () => void,
}

type JoinChannelRow = {
  type: 'join channel',
  teamname: string,
  onJoinChannel: () => void,
}

type LeaveChannelRow = {
  type: 'leave channel',
  onLeaveConversation: () => void,
}

type TeamRow =
  | BigHeaderRow
  | ParticipantRow
  | DividerRow
  | TurnIntoTeamRow
  | NotificationsRow
  | BlockThisConversationRow
  | SmallTeamHeaderRow
  | ManageTeamRow
  | BigTeamHeaderRow
  | JoinChannelRow
  | LeaveChannelRow
type RowType = $PropertyType<TeamRow, 'type'>

const _renderTeamRow = (i: number, props: TeamRow) => {
  switch (props.type) {
    case 'divider':
      return (
        <Divider
          key={props.key}
          style={{
            marginBottom: props.marginBottom || globalMargins.small,
            marginTop: props.marginTop || globalMargins.small,
          }}
        />
      )

    case 'turn into team':
      return <TurnIntoTeam key="turn into team" onClick={props.onShowNewTeamDialog} />

    case 'notifications':
      return <Notifications key="notifications" />

    case 'block this conversation':
      return (
        <ButtonBar key="block this conversation" small={true}>
          <Button
            type="Danger"
            small={true}
            label="Block this conversation"
            onClick={props.onShowBlockConversationDialog}
          />
        </ButtonBar>
      )

    case 'small team header':
      return (
        <SmallTeamHeader
          key="small team header"
          teamname={props.teamname}
          participantCount={props.participantCount}
          onClick={props.onViewTeam}
        />
      )

    case 'manage team':
      return (
        <ManageTeam
          key="manage team"
          canManage={props.canManage}
          label={props.label}
          participantCount={props.participantCount}
          onClick={props.onViewTeam}
        />
      )

    case 'big team header':
      return (
        <BigTeamHeader
          key="big team header"
          channelname={props.channelname}
          teamname={props.teamname}
          onClick={props.onViewTeam}
        />
      )

    case 'join channel':
      return (
        <Box key="join channel" style={{...globalStyles.flexBoxColumn}}>
          <Box key="join channel" style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
            <Button
              type="Primary"
              label="Join channel"
              style={{marginRight: globalMargins.xtiny}}
              small={true}
              onClick={props.onJoinChannel}
            />
          </Box>
          <Text
            key="anyone can join"
            type="BodySmall"
            style={{textAlign: 'center', marginTop: globalMargins.xtiny}}
          >
            Anyone in {props.teamname} can join.
          </Text>
        </Box>
      )

    case 'leave channel':
      return (
        <Box key="leave channel" style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
          <Button type="Danger" small={true} label="Leave channel" onClick={props.onLeaveConversation} />
        </Box>
      )

    case 'participant':
      return <Participant key={props.key} {...props} />

    default:
      throw new Error('Unexpected type ' + props.type)
  }
}

const typeSizeEstimator = (type: RowType): number => {
  // The sizes below are retrieved by using the React DevTools
  // inspector on the appropriate components, including margins.
  switch (type) {
    case 'divider':
      // estimate based on default values.
      return 1 + 2 * globalMargins.small

    case 'turn into team':
      return 44 + 15

    case 'notifications':
      return 270

    case 'block this conversation':
      return 44

    case 'small team header':
      return 32

    case 'manage team':
      return 15

    case 'big team header':
      return 1

    case 'join channel':
      return 1

    case 'leave channel':
      return 1

    case 'big header':
      return 469 // estimate based on size of header in non-admin non-preview mode
    case 'participant':
      return 56

    default:
      throw new Error('Unexpected type ' + type)
  }
}

const _InfoPanel = (props: InfoPanelProps) => {
  const participants: Array<ParticipantRow> = props.participants.map(participant => ({
    type: 'participant',
    key: participant.username,

    ...participant,
    onShowProfile: props.onShowProfile,
  }))

  const participantCount = participants.length

  let rows: Array<TeamRow>
  if (props.teamname && props.channelname) {
    if (props.smallTeam) {
      rows = [
        {
          type: 'small team header',
          teamname: props.teamname,
          participantCount,
          onViewTeam: props.onViewTeam,
        },
        {
          type: 'divider',
          key: 'divider 1',
          marginBottom: 20,
          marginTop: 20,
        },
        {
          type: 'notifications',
        },
        {
          type: 'divider',
          key: 'divider 2',
        },
        {
          type: 'manage team',
          canManage: props.admin,
          label: 'In this team',
          participantCount,
          onViewTeam: props.onViewTeam,
        },
      ].concat(participants)
    } else {
      if (props.isPreview) {
        rows = [
          {
            type: 'big team header',
            teamname: props.teamname,
            channelname: props.channelname,
            onViewTeam: props.onViewTeam,
          },
          {
            type: 'divider',
            key: 'divider 1',
          },
          {
            type: 'join channel',
            teamname: props.teamname,
            onJoinChannel: props.onJoinChannel,
          },
          {
            type: 'divider',
            key: 'divider 2',
          },
          {
            type: 'manage team',
            canManage: props.admin && props.channelname === 'general',
            label: 'In this channel',
            participantCount,
            onViewTeam: props.onViewTeam,
          },
        ].concat(participants)
      } else {
        rows = [
          {
            type: 'big team header',
            teamname: props.teamname,
            channelname: props.channelname,
            onViewTeam: props.onViewTeam,
          },
          {
            type: 'divider',
            key: 'divider 1',
          },
          {
            type: 'notifications',
          },
          {
            type: 'divider',
            key: 'divider 2',
          },
          {
            type: 'leave channel',
            onLeaveConversation: props.onLeaveConversation,
          },
          {
            type: 'divider',
            key: 'divider 3',
          },
          {
            type: 'manage team',
            canManage: props.admin && props.channelname === 'general',
            label: 'In this channel',
            participantCount,
            onViewTeam: props.onViewTeam,
          },
        ].concat(participants)
      }
    }
  } else {
    rows = participants.concat([
      {
        type: 'divider',
        key: 'divider 1',
        marginBottom: 10,
        marginTop: 10,
      },
      {
        type: 'turn into team',
        onShowNewTeamDialog: props.onShowNewTeamDialog,
      },
      {
        type: 'divider',
        key: 'divider 2',
      },
      {
        type: 'notifications',
      },
      {
        type: 'divider',
        key: 'divider 3',
        marginBottom: 10,
      },
      {
        type: 'block this conversation',
        onShowBlockConversationDialog: props.onShowBlockConversationDialog,
      },
    ])
  }

  const rowSizeEstimator = index => typeSizeEstimator(rows[index].type)
  return (
    <List
      items={rows}
      renderItem={_renderTeamRow}
      keyProperty="key"
      style={listStyle}
      itemSizeEstimator={rowSizeEstimator}
    />
  )
}

const InfoPanel = isMobile ? HeaderHoc(_InfoPanel) : _InfoPanel

export type {InfoPanelProps}
export {InfoPanel}
