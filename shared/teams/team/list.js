// @flow
import * as React from 'react'
import * as Types from '../../constants/types/teams'
import * as RPCTypes from '../../constants/types/rpc-gen'
import TeamHeader from './header/container'
import TeamTabs from './tabs'
import {MemberRows} from './members/container'
import Subteams from './subteams/container'
import Invites from './invites/container'
import Settings from './settings/container'
import RenderList from './list.render'

type HeaderRow = {
  type: 'header',
  teamname: Types.Teamname,
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

type TeamRow = HeaderRow | TabsRow | MembersRow | SubteamsRow | InvitesRow | SettingsRow

type TeamRows = Array<TeamRow>

const renderRow = (index: number, row: TeamRow) => {
  switch (row.type) {
    case 'header': {
      return <TeamHeader key="header" teamname={row.teamname} />
    }
    case 'tabs': {
      return <TeamTabs key="tabs" {...row} />
    }
    case 'members': {
      return <MemberRows key="members" teamname={row.teamname} />
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

type Props = {
  rows: TeamRows,
}

export type {TeamRow, TeamRows}
export default (props: Props) => <RenderList rows={props.rows} renderRow={renderRow} />
