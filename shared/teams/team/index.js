// @flow
import * as React from 'react'
import * as Types from '../../constants/types/teams'
import {Box, Icon} from '../../common-adapters'
import {globalStyles, globalMargins, isMobile} from '../../styles'
import List, {type TeamRows} from './list'

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
  selectedTab: Types.TabKey,
  resetUserCount: number,
  setSelectedTab: Types.TabKey => void,
  yourOperations: Types.TeamOperations,
  onShowMenu: any => void,
}

const Team = (props: Props) => {
  const {teamname} = props

  const rows: TeamRows = [{type: 'header', teamname, key: 'headerKey'}]
  rows.push({
    type: 'tabs',
    key: 'tabs',
    teamname,
    selectedTab: props.selectedTab,
    setSelectedTab: props.setSelectedTab,
  })

  if (props.selectedTab === 'publicity') {
    rows.push({type: 'settings', teamname, key: 'settings'})
  } else if (props.listItems) {
    rows.push(...props.listItems)
  }

  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      <List headerRow={rows[0]} bodyRows={rows.splice(1)} />
    </Box>
  )
}
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
