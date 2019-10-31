import * as React from 'react'
import MemberRow from './member-row/container'

export const renderItem = (
  teamname: string,
  row: {
    username: string
  }
) => <MemberRow teamname={teamname} username={row.username} key={row.username} />
