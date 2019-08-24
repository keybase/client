import * as React from 'react'
import {Box, Text} from '../../../common-adapters'
import {globalMargins, globalStyles} from '../../../styles'

type Props = {
  label: string
  participantCount: number
}

const ParticipantCount = ({label, participantCount}: Props) => (
  <Box style={{...globalStyles.flexBoxRow, marginRight: globalMargins.small}}>
    <Text style={{flex: 1, paddingLeft: globalMargins.small}} type="BodySmallSemibold">
      {label} ({participantCount.toString()})
    </Text>
  </Box>
)

export {ParticipantCount}
