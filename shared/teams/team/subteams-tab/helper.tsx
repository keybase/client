import * as React from 'react'
import Add from './add-row/container'
import Intro from './intro-row/container'
import None from './none-row'
import Team from './team-row/container'

export const renderItem = (
  teamname: string,
  row: {
    teamname: string
    type: string
  }
) => {
  switch (row.type) {
    case 'subteam-intro':
      return <Intro key="subteam-intro" teamname={teamname} />
    case 'subteam-add':
      return <Add key="subteam-add" teamname={teamname} />
    case 'subteam-none':
      return <None key="subteam-none" />
    case 'subteam-subteam':
      return <Team key={row.teamname} teamname={row.teamname} />
    default:
      return null
  }
}
