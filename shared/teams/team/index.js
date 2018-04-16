// @flow
import * as React from 'react'
import * as Types from '../../constants/types/teams'
import {renderItem as renderInvitesItem} from './invites-tab/helper'
import {renderItem as renderMemeberItem} from './members-tab/helper'
import {renderItem as renderSubteamsItem} from './subteams-tab/helper'
import Settings from './settings/container'
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
        return renderMemeberItem(this.props.teamname, row)
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
        <List items={this.props.rows} renderItem={this._renderItem} windowsSize={10} />
      </Box>
    )
  }
}

export default Team
