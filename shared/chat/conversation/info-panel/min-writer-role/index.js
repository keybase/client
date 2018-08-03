// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as TeamTypes from '../../../../constants/types/teams'

type Props = {
  canSetMinWriterRole: boolean,
  minWriterRole: TeamTypes.TeamRoleType,
  onSetNewRole: (newRole: TeamTypes.TeamRoleType) => void,
}

const MinWriterRole = (props: Props) => {
  return <Kb.Text type="HeaderBig">{props.minWriterRole}</Kb.Text>
}

export default MinWriterRole
