// @flow
import * as React from 'react'
import {List} from '../../../common-adapters'
import MemberRow from './member-row/container'

export type Props = {
  members: Array<{
    fullName: string,
    username: string,
    teamname: string,
    active: boolean,
    key: string,
  }>,
}

export const Members = (props: Props) => (
  <List items={props.members} fixedHeight={48} renderItem={MemberRow} style={{alignSelf: 'stretch'}} />
)

export function MemberRows(props: Props): React.Node[] {
  const rows = []
  const {members} = props
  let i = 0
  while (members.length) {
    rows.push(MemberRow(i, members.pop()))
    i++
  }
  return rows
}
