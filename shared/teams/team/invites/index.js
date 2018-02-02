// @flow
import * as React from 'react'
import {Box, List, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import InviteRow from './invite-row/container'
import RequestRow from './request-row/container'

export type Props = {
  requestsAndInvites: any[],
}

const DividerRow = (index, {key}) => (
  <Box
    key={key}
    style={{
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      flexShrink: 0,
      height: globalMargins.medium,
      padding: globalMargins.tiny,
      width: '100%',
    }}
  >
    <Box style={{...globalStyles.flexBoxRow, flexGrow: 1}}>
      <Text style={{color: globalColors.black_40}} type="BodySmall">
        {key}
      </Text>
    </Box>
  </Box>
)

const TeamRequestOrDividerOrInviteRow = (index, row) => {
  switch (row.type) {
    case 'request':
      return RequestRow(index, row)
    case 'invite':
      return InviteRow(index, row)
    default:
      return DividerRow(index, row)
  }
}

export const RequestsAndInvites = (props: Props) => {
  if (props.requestsAndInvites.length === 0) {
    return (
      <Text
        type="BodySmall"
        style={{color: globalColors.black_40, marginTop: globalMargins.xlarge, textAlign: 'center'}}
      >
        This team has no pending invites.
      </Text>
    )
  }
  return (
    <List
      items={props.requestsAndInvites}
      fixedHeight={48}
      keyProperty="key"
      renderItem={TeamRequestOrDividerOrInviteRow}
      style={{alignSelf: 'stretch'}}
    />
  )
}
