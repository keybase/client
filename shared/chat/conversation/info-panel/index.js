// @flow
import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import {Divider, HeaderHoc, List} from '../../../common-adapters'
import {type Props as HeaderHocProps} from '../../../common-adapters/header-hoc'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../../styles'
import {SmallTeamHeader, BigTeamHeader} from './header'
import Notifications from './notifications/container'
import Participant from './participant'
import {ManageTeam} from './manage-team'
import {CaptionedButton, DangerButton} from './button-utils'

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
  selectedConversationIDKey: Types.ConversationIDKey,
  participants: Array<{
    username: string,
    fullname: string,
  }>,
  isPreview: boolean,
  teamname: ?string,
  channelname: ?string,
  smallTeam: boolean,
  admin: boolean,

  // Used by HeaderHoc.
  onBack: () => void,

  // Used by Participant.
  onShowProfile: (username: string) => void,

  // Used for conversations.
  onShowBlockConversationDialog: () => void,
  onShowNewTeamDialog: () => void,

  // Used for small and big teams.
  onViewTeam: () => void,

  // Used for big teams.
  onLeaveConversation: () => void,
  onJoinChannel: () => void,
} & HeaderHocProps

type ParticipantRow = {
  type: 'participant',
  key: string,
  username: string,
  fullname: string,
  onShowProfile: string => void,
}

type DividerRow = {
  type: 'divider',
  key: string,
  marginTop?: number,
  marginBottom?: number,
}

const getDividerStyle = (row: DividerRow) => ({
  marginBottom: 'marginBottom' in row ? row.marginBottom : globalMargins.small,
  marginTop: 'marginTop' in row ? row.marginTop : globalMargins.small,
})

type NotificationsRow = {
  type: 'notifications',
}

type TurnIntoTeamRow = {
  type: 'turn into team',
  onShowNewTeamDialog: () => void,
}

type BlockThisConversationRow = {
  type: 'block this conversation',
  onShowBlockConversationDialog: () => void,
}

type ManageTeamRow = {
  type: 'manage team',
  canManage: boolean,
  label: string,
  participantCount: number,
  onViewTeam: () => void,
}

type SmallTeamHeaderRow = {
  type: 'small team header',
  teamname: string,
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

// All the row types that can appear in a small or big team header.
type TeamHeaderRow =
  | DividerRow
  | NotificationsRow
  | ManageTeamRow
  | SmallTeamHeaderRow
  | BigTeamHeaderRow
  | JoinChannelRow
  | LeaveChannelRow

type Row =
  | ParticipantRow
  | DividerRow
  | NotificationsRow
  | TurnIntoTeamRow
  | BlockThisConversationRow
  | TeamHeaderRow

const typeSizeEstimator = (row: Row): number => {
  // The sizes below are retrieved by using the React DevTools
  // inspector on the appropriate components, including margins.
  switch (row.type) {
    case 'participant':
      return 56

    case 'divider':
      const style = getDividerStyle(row)
      return 1 + style.marginTop + style.marginBottom

    case 'notifications':
      return 270

    case 'turn into team':
      return 47

    case 'block this conversation':
      return 44

    case 'manage team':
      return 15

    case 'small team header':
      return 32

    case 'big team header':
      return 57

    case 'join channel':
      return 47

    case 'leave channel':
      return 44

    default:
      // eslint-disable-next-line no-unused-expressions
      ;(row.type: empty)
      throw new Error(`Impossible case encountered: ${row.type}`)
  }
}

class _InfoPanel extends React.Component<InfoPanelProps> {
  _renderRow = (i: number, row: Row): React.Node => {
    switch (row.type) {
      case 'participant':
        return <Participant key={`participant ${row.key}`} {...row} />

      case 'divider':
        return <Divider key={`divider ${row.key}`} style={getDividerStyle(row)} />

      case 'notifications':
        return <Notifications key="notifications" conversationIDKey={this.props.selectedConversationIDKey} />

      case 'turn into team':
        return (
          <CaptionedButton
            caption="You'll be able to add and delete members as you wish."
            key="turn into team"
            label="Turn into team"
            onClick={row.onShowNewTeamDialog}
          />
        )

      case 'block this conversation':
        return (
          <DangerButton
            key="block this conversation"
            label="Block this conversation"
            onClick={row.onShowBlockConversationDialog}
          />
        )

      case 'manage team':
        return (
          <ManageTeam
            key="manage team"
            canManage={row.canManage}
            label={row.label}
            participantCount={row.participantCount}
            onClick={row.onViewTeam}
          />
        )

      case 'small team header':
        return (
          <SmallTeamHeader
            key="small team header"
            teamname={row.teamname}
            participantCount={row.participantCount}
            onClick={row.onViewTeam}
          />
        )

      case 'big team header':
        return (
          <BigTeamHeader
            key="big team header"
            channelname={row.channelname}
            teamname={row.teamname}
            onClick={row.onViewTeam}
          />
        )

      case 'join channel':
        return (
          <CaptionedButton
            caption={`Anyone in ${row.teamname} can join.`}
            key="join channel"
            label="Join channel"
            onClick={row.onJoinChannel}
          />
        )

      case 'leave channel':
        return <DangerButton key="leave channel" label="Leave channel" onClick={row.onLeaveConversation} />

      default:
        // eslint-disable-next-line no-unused-expressions
        ;(row.type: empty)
        throw new Error(`Impossible case encountered: ${row.type}`)
    }
  }

  render() {
    const props = this.props
    const participants: Array<ParticipantRow> = props.participants.map(p => ({
      type: 'participant',
      key: p.username,
      username: p.username,
      fullname: p.fullname,
      onShowProfile: props.onShowProfile,
    }))

    const participantCount = participants.length

    let rows: Array<Row>
    const {teamname, channelname, onViewTeam} = props
    if (teamname && channelname) {
      let headerRows: Array<TeamHeaderRow>
      if (props.smallTeam) {
        // Small team.
        headerRows = [
          {
            type: 'small team header',
            teamname,
            participantCount,
            onViewTeam,
          },
          {
            type: 'divider',
            key: '1',
            marginBottom: 20,
            marginTop: 20,
          },
          {
            type: 'notifications',
          },
          {
            type: 'divider',
            key: '2',
          },
          {
            type: 'manage team',
            canManage: props.admin,
            label: 'In this team',
            participantCount,
            onViewTeam: onViewTeam,
          },
        ]
      } else {
        // Big team.
        const headerRow = {
          type: 'big team header',
          teamname,
          channelname,
          onViewTeam,
        }
        const manageTeamRow = {
          type: 'manage team',
          canManage: props.admin && channelname === 'general',
          label: 'In this channel',
          participantCount,
          onViewTeam,
        }

        if (props.isPreview) {
          // Big team, preview.
          headerRows = [
            headerRow,
            {
              type: 'divider',
              key: '1',
            },
            {
              type: 'join channel',
              teamname,
              onJoinChannel: props.onJoinChannel,
            },
            {
              type: 'divider',
              key: '2',
            },
            manageTeamRow,
          ]
        } else {
          // Big team, no preview.
          headerRows = [
            headerRow,
            {
              type: 'divider',
              key: '1',
            },
            {
              type: 'notifications',
            },
            {
              type: 'divider',
              key: '2',
              marginBottom: globalMargins.tiny,
            },
            {
              type: 'leave channel',
              onLeaveConversation: props.onLeaveConversation,
            },
            {
              type: 'divider',
              key: '3',
              marginTop: globalMargins.tiny,
            },
            manageTeamRow,
          ]
        }
      }
      rows = headerRows.concat(participants)
    } else {
      // Conversation.
      rows = participants.concat([
        {
          type: 'divider',
          key: '1',
          marginBottom: 10,
          marginTop: 10,
        },
        {
          type: 'turn into team',
          onShowNewTeamDialog: props.onShowNewTeamDialog,
        },
        {
          type: 'divider',
          key: '2',
        },
        {
          type: 'notifications',
        },
        {
          type: 'divider',
          key: '3',
          marginBottom: 10,
        },
        {
          type: 'block this conversation',
          onShowBlockConversationDialog: props.onShowBlockConversationDialog,
        },
      ])
    }

    const rowSizeEstimator = index => typeSizeEstimator(rows[index])
    return (
      <List
        items={rows}
        renderItem={this._renderRow}
        keyProperty="key"
        style={listStyle}
        itemSizeEstimator={rowSizeEstimator}
      />
    )
  }
}

const InfoPanel = isMobile ? HeaderHoc(_InfoPanel) : _InfoPanel

export type {InfoPanelProps}
export {InfoPanel}
