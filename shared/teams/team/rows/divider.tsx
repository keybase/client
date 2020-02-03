import * as React from 'react'
import * as Kb from '../../../common-adapters'

// Based on type, render a plain label with (count)
// or a collapsible one that persists in the store.

type Props = {
  count: number
  type: 'requests' | 'invites' | 'members'
}

const typeToLabel = {invites: 'Invitations', members: 'Already in team', requests: 'Requests'}

const TeamPageDivider = (props: Props) => {
  return <Kb.SectionDivider label={typeToLabel[props.type] + ` (${props.count})`} />
}

export default TeamPageDivider
