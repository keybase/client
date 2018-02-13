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

const dividerStyle = {
  marginBottom: globalMargins.small,
  marginTop: globalMargins.small,
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

type SmallHeaderRow = {
  type: 'small header',
  key: 'SMALL HEADER',

  teamname: string,
  admin: boolean,
  participantCount: number,

  onViewTeam: () => void,
}

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

type TeamRow =
  | SmallHeaderRow
  | BigHeaderRow
  | ParticipantRow
  | DividerRow
  | TurnIntoTeamRow
  | NotificationsRow
  | BlockThisConversationRow
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

    case 'small header':
      return (
        <Box key={props.key} style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
          <SmallTeamHeader
            teamname={props.teamname}
            participantCount={props.participantCount}
            onClick={props.onViewTeam}
          />

          <Divider style={{marginBottom: 20, marginTop: 20}} />

          <Notifications />
          <Divider style={dividerStyle} />

          <ManageTeam
            canManage={props.admin}
            label="In this team"
            participantCount={props.participantCount}
            onClick={props.onViewTeam}
          />
        </Box>
      )

    case 'big header':
      return (
        <Box key={props.key} style={{...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
          <BigTeamHeader
            channelname={props.channelname}
            teamname={props.teamname}
            onClick={props.onViewTeam}
          />

          {!props.isPreview && (
            <Box>
              <Divider style={dividerStyle} />
              <Notifications />
            </Box>
          )}

          <Divider style={dividerStyle} />

          <Box style={{...globalStyles.flexBoxRow, justifyContent: 'center'}}>
            {props.isPreview && (
              <Button
                type="Primary"
                label="Join channel"
                style={{marginRight: globalMargins.xtiny}}
                small={true}
                onClick={props.onJoinChannel}
              />
            )}
            {!props.isPreview && (
              <Button type="Danger" small={true} label="Leave channel" onClick={props.onLeaveConversation} />
            )}
          </Box>

          {props.isPreview && (
            <Text type="BodySmall" style={{textAlign: 'center', marginTop: globalMargins.xtiny}}>
              Anyone in {props.teamname} can join.
            </Text>
          )}

          <Divider style={dividerStyle} />

          <ManageTeam
            canManage={props.admin && props.channelname === 'general'}
            label="In this channel"
            participantCount={props.participantCount}
            onClick={props.onViewTeam}
          />
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

    case 'small header':
      return 407

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
          type: 'small header',
          key: 'SMALL HEADER',

          teamname: props.teamname,
          admin: props.admin,
          participantCount,

          onViewTeam: props.onViewTeam,
        },
      ].concat(participants)
    } else {
      rows = [
        {
          type: 'big header',
          key: 'BIG HEADER',

          isPreview: props.isPreview,
          teamname: props.teamname,
          channelname: props.channelname,
          admin: props.admin,
          participantCount,

          onViewTeam: props.onViewTeam,
          onJoinChannel: props.onJoinChannel,
          onLeaveConversation: props.onLeaveConversation,
        },
      ].concat(participants)
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
