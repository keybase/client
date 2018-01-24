// @flow
import * as React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalMargins, globalStyles} from '../../../styles'

type Props = {
  canManage: boolean,
  label: string,
  participantCount: number,
  onClick: () => void,
}

const ManageTeam = ({canManage, label, participantCount, onClick}: Props) => (
  <Box style={{...globalStyles.flexBoxRow, marginRight: globalMargins.small}}>
    <Text style={{flex: 1, paddingLeft: globalMargins.small}} type="BodySmallSemibold">
      {label} ({participantCount.toString()})
    </Text>
    {canManage && (
      <Text type="BodySmallPrimaryLink" onClick={onClick}>
        Manage
      </Text>
    )}
  </Box>
)

export {ManageTeam}
