// @flow
import * as React from 'react'
import TeamHeader from './header/container'
import TeamTabs from './tabs'
import renderMemberRow from './members/member-row/container'
import {renderSubteamsRow} from './subteams/index'
import Invites from './invites/container'
import Settings from './settings/container'
import RenderList from './list.render'
import type {TeamRow, TeamRows} from './row-types'

const renderRow = (index: number, row: TeamRow) => {
  console.log(row)
  switch (row.type) {
    case 'header': {
      return <TeamHeader key="header" teamname={row.teamname} />
    }
    case 'tabs': {
      return <TeamTabs key="tabs" {...row} />
    }
    case 'member': {
      return renderMemberRow(index, row)
    }
    case 'subteam': {
      return renderSubteamsRow(index, row)
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
  headerRow: TeamRow,
  bodyRows: TeamRows,
}

export type {TeamRow, TeamRows}
export default (props: Props) => (
  <RenderList
    headerRow={props.headerRow}
    bodyRows={props.bodyRows}
    rows={[props.headerRow, ...props.bodyRows]}
    renderRow={renderRow}
  />
)
