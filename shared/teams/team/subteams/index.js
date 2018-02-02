// @flow
import * as React from 'react'
import * as I from 'immutable'
import * as Types from '../../../constants/types/teams'
import {Box, ClickableBox, Icon, List, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import TeamSubteamRow from '../subteam-row/container'
import SubteamBanner from '../subteam-banner'

export type Props = {
  onCreateSubteam: () => void,
  onHideSubteamsBanner: () => void,
  onReadMoreAboutSubteams: () => void,
  sawSubteamsBanner: boolean,
  subteams: I.List<Types.Teamname>,
  teamname: Types.Teamname,
  yourOperations: Types.TeamOperations,
}

const SubteamsIntro = ({row}) => (
  <SubteamBanner
    key={row.key}
    onHideSubteamsBanner={row.onHideSubteamsBanner}
    onReadMore={row.onReadMore}
    teamname={row.teamname}
  />
)

const SubteamRow = ({row}) => (
  <Box key={row.teamname + 'row'}>
    <TeamSubteamRow teamname={row.teamname} />
  </Box>
)

const AddSubTeam = ({row}) => (
  <Box
    key="addSubteam"
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
    key="noSubteams"
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

const subTeamsRow = (index, row) => {
  switch (row.type) {
    case 'intro':
      return <SubteamsIntro row={row} />
    case 'addSubteam':
      return <AddSubTeam row={row} />
    case 'noSubteams':
      return <NoSubteams row={row} />
    default:
      return <SubteamRow row={row} />
  }
}

export const Subteams = (props: Props) => {
  const noSubteams = props.subteams.isEmpty()
  const subTeamsItems = [
    ...(!props.sawSubteamsBanner
      ? [
          {
            key: 'intro',
            onHideSubteamsBanner: props.onHideSubteamsBanner,
            onReadMore: props.onReadMoreAboutSubteams,
            teamname: props.teamname,
            type: 'intro',
          },
        ]
      : []),
    ...(props.yourOperations.manageSubteams
      ? [{key: 'addSubteam', type: 'addSubteam', onCreateSubteam: props.onCreateSubteam}]
      : []),
    ...props.subteams.map(subteam => ({key: subteam, teamname: subteam, type: 'subteam'})),
    ...(noSubteams ? [{key: 'noSubteams', type: 'noSubteams'}] : []),
  ]

  return (
    <List
      items={subTeamsItems}
      fixedHeight={48}
      keyProperty="key"
      renderItem={subTeamsRow}
      style={{alignSelf: 'stretch'}}
    />
  )
}
