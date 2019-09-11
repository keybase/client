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
  teamname: Types.Teamname
  selectedTab: string
  // TODO better type
  rows: Array<any>
  setSelectedTab: (arg0: Types.TabKey) => void
}

class Team extends React.Component<Props> {
  _renderItem = (row: any) => {
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
        // @ts-ignore doesn't seem to understand connect here
        return <Settings key="settings" teamname={this.props.teamname} />
      default: {
        throw new Error(`Impossible case encountered in team page list: ${row}`)
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
