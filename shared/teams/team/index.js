// @flow
import * as React from 'react'
import * as Types from '../../constants/types/teams'
import {renderItem as renderInvitesItem} from './invites-tab/helper'
import {renderItem as renderMemberItem} from './members-tab/helper'
import {renderItem as renderSubteamsItem} from './subteams-tab/helper'
import Settings from './settings-tab/container'
import TeamHeader from './header/container'
import TeamTabs from './tabs/container'
import {Box} from '../../common-adapters'
import List from './list'
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
  rows: Array<*>,
  setSelectedTab: (?Types.TabKey) => void,
  yourOperations: Types.TeamOperations,
  onShowMenu: any => void,
}

class Team extends React.Component<Props> {
  _renderItem = row => {
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
        return renderMemberItem(this.props.teamname, row)
      case 'invites-invite':
      case 'invites-request':
      case 'invites-divider':
      case 'invites-none':
        return renderInvitesItem(this.props.teamname, row)
      case 'subteam-intro':
      case 'subteam-add':
      case 'subteam-none':
      case 'subteam-subteam':
        return renderSubteamsItem(this.props.teamname, row)
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
        <List rows={this.props.rows} renderRow={this._renderItem} />
      </Box>
    )
  }
}

export default Team
