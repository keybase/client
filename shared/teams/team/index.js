// @flow
import * as React from 'react'
import * as Types from '../../constants/types/teams'
import InviteDividerRow from './divider-row'
import InviteEmptyRow from './empty-row'
import InviteRow from './invite-row/container'
import MemberRow from './member-row/container'
import RequestRow from './request-row/container'
import Settings from './settings/container'
import SubteamAdd from './subteam-add/container'
import SubteamIntro from './subteam-intro/container'
import SubteamNone from './subteam-none'
import SubteamSubteam from './subteam-subteam/container'
import TeamHeader from './header/container'
import TeamTabs from './tabs/container'
import {Box, List} from '../../common-adapters'
import {globalStyles} from '../../styles'

export type Props = {
  teamname: Types.Teamname,
  admin: boolean,
  memberCount: number,
  newTeamRequests: Array<Types.Teamname>,
  numInvites: number,
  numRequests: number,
  numSubteams: number,
  listItems?: Array<any>,
  loading: boolean,
  selectedTab: string,
  resetUserCount: number,
  setSelectedTab: (?Types.TabKey) => void,
  yourOperations: Types.TeamOperations,
  onShowMenu: any => void,
}

class Team extends React.Component<Props> {
  _renderItem = (index, row) => {
    switch (row.type) {
      case 'header':
        return <TeamHeader key="header" teamname={this.props.teamname} />
      case 'tabs': {
        return (
          <TeamTabs
            key="tabs"
            teamname={this.props.teamname}
            selectedTab={this.props.selectedTab}
            setSelectedTab={this.props.setSelectedTab}
          />
        )
      }
      case 'member':
        return <MemberRow teamname={this.props.teamname} username={row.username} key={row.username} />
      case 'invite':
        return <InviteRow teamname={this.props.teamname} id={row.id} key={row.id} />
      case 'request':
        return <RequestRow teamname={this.props.teamname} username={row.username} key={row.username} />
      case 'divider':
        return <InviteDividerRow key={row.label} label={row.label} />
      case 'none':
        return <InviteEmptyRow key="invite-empty" />
      case 'subteam-intro':
        return <SubteamIntro key="subteam-intro" teamname={this.props.teamname} />
      case 'subteam-add':
        return <SubteamAdd key="subteam-add" teamname={this.props.teamname} />
      case 'subteam-none':
        return <SubteamNone key="subteam-none" />
      case 'subteam-subteam':
        return <SubteamSubteam key={row.teamname} teamname={row.teamname} />
      case 'settings':
        return <Settings key="settings" teamname={this.props.teamname} />
      default: {
        // eslint-disable-next-line no-unused-expressions
        ;(row.type: empty)
        throw new Error(`Impossible case encountered in team page list: ${row.type}`)
      }
    }
  }

  render() {
    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'stretch',
          flex: 1,
          height: '100%',
          position: 'relative',
          width: '100%',
        }}
      >
        <List items={this.props.rows} renderItem={this._renderItem} windowsSize={10} />
      </Box>
    )
  }
}

export default Team
