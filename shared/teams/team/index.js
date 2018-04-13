// @flow
import * as React from 'react'
import * as Types from '../../constants/types/teams'
import {Box, Icon, List} from '../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../styles'
// import List, {type TeamRows} from './list'
import TeamHeader from './header/container'
import TeamTabs from './tabs/container'
import MemberRow from './member-row/container'

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

      // case 'subteam': {
      // return renderSubteamsRow(index, row)
      // }
      // case 'invites': {
      // return renderRequestsOrInvitesRow(index, row)
      // }
      // case 'settings': {
      // return <Settings key="settings" teamname={row.teamname} />
      // }
      // default: {
      // // eslint-disable-next-line no-unused-expressions
      // ;(row.type: empty)
      // throw new Error(`Impossible case encountered in team page list: ${row.type}`)
      // }
      default:
        return <Box style={{width: 10, height: 10, backgroundColor: 'red'}} />
    }
  }

  render() {
    // const {teamname} = props

    // const rows: TeamRows = [{type: 'header', teamname, key: 'headerKey'}]
    // rows.push({
    // type: 'tabs',
    // key: 'tabs',
    // admin: props.yourOperations.manageMembers,
    // memberCount: props.memberCount,
    // teamname,
    // newTeamRequests: props.newTeamRequests,
    // numInvites: props.numInvites,
    // numRequests: props.numRequests,
    // numSubteams: props.numSubteams,
    // loading: props.loading,
    // resetUserCount: props.resetUserCount,
    // selectedTab: props.selectedTab,
    // setSelectedTab: props.setSelectedTab,
    // yourOperations: props.yourOperations,
    // })

    // if (props.selectedTab === 'publicity') {
    // rows.push({type: 'settings', teamname, key: 'settings'})
    // } else if (props.listItems) {
    // rows.push(...props.listItems)
    // }

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
// <List headerRow={rows[0]} bodyRows={rows.splice(1)} />
export default Team

type CustomProps = {
  onOpenFolder: () => void,
  onChat: () => void,
  onShowMenu: any => void,
  canChat: boolean,
  canViewFolder: boolean,
}

const CustomComponent = ({onOpenFolder, onChat, onShowMenu, canChat, canViewFolder}: CustomProps) => (
  <Box style={{...globalStyles.flexBoxRow, position: 'absolute', alignItems: 'center', right: 0}}>
    {canChat && (
      <Icon
        onClick={onChat}
        style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
        type="iconfont-chat"
      />
    )}
    {!isMobile &&
      canViewFolder && (
        <Icon
          onClick={onOpenFolder}
          style={{fontSize: isMobile ? 20 : 16, marginRight: globalMargins.tiny}}
          type="iconfont-folder-private"
        />
      )}
    <Icon
      onClick={evt => onShowMenu(isMobile ? undefined : evt.target)}
      type="iconfont-ellipsis"
      style={{
        fontSize: isMobile ? 20 : 16,
        marginRight: globalMargins.tiny,
      }}
    />
  </Box>
)
export {CustomComponent}
