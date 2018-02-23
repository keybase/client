// @flow
import * as React from 'react'
import type {SubteamRow} from '../row-types'
import {Box, ClickableBox, Icon, List, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import TeamSubteamRow from './subteam-row/container'
import SubteamBanner from './subteam-banner'

export type Props = {
  listItems: Array<any>,
}

const SubteamsIntro = ({row}) => (
  <SubteamBanner
    onHideSubteamsBanner={row.onHideSubteamsBanner}
    onReadMore={row.onReadMore}
    teamname={row.teamname}
  />
)

const SubteamRowRender = ({row}) => (
  <Box>
    <TeamSubteamRow teamname={row.teamname} />
  </Box>
)

const AddSubTeam = ({row}) => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      height: globalMargins.medium,
      padding: globalMargins.medium,
      width: '100%',
    }}
  >
    <ClickableBox
      onClick={row.onCreateSubteam}
      style={{...globalStyles.flexBoxRow, flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}
    >
      <Icon type="iconfont-new" style={{color: globalColors.blue}} />
      <Text type="BodyBigLink" style={{padding: globalMargins.xtiny}}>
        Create subteam
      </Text>
    </ClickableBox>
  </Box>
)

const NoSubteams = ({row}) => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      height: globalMargins.medium,
      padding: globalMargins.tiny,
      width: '100%',
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Text type="BodySmall">This team has no subteams.</Text>
    </Box>
  </Box>
)

export const renderSubteamsRow = (index: number, row: SubteamRow) => {
  switch (row.subtype) {
    case 'intro':
      return <SubteamsIntro key={row.key} row={row} />
    case 'addSubteam':
      return <AddSubTeam key={row.key} row={row} />
    case 'noSubteams':
      return <NoSubteams key={row.key} row={row} />
    default:
      return <SubteamRowRender key={row.key} row={row} />
  }
}

export const Subteams = (props: Props) => {
  return (
    <List
      items={props.listItems}
      keyProperty="key"
      renderItem={renderSubteamsRow}
      style={{alignSelf: 'stretch'}}
    />
  )
}
