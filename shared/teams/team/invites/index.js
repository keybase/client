// @flow
import * as React from 'react'
import {Box, List, Text} from '../../../common-adapters'
import {globalColors, globalMargins, globalStyles} from '../../../styles'
import InviteRow from './invite-row/container'
import RequestRow from './request-row/container'
import type {RequestsOrInvitesRow} from '../row-types'

export type Props = {
  requestsAndInvites: RequestsOrInvitesRow[],
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

export const renderRequestsOrInvitesRow = (index: number, row: RequestsOrInvitesRow) => {
  switch (row.subtype) {
    case 'none':
      return (
        <Box style={{...globalStyles.flexBoxRow, ...globalStyles.flexBoxCenter}}>
          <Text
            type="BodySmall"
            key="noRequestsOrInvites"
            style={{
              color: globalColors.black_40,
              paddingTop: globalMargins.large,
            }}
          >
            This team has no pending invites.
          </Text>
        </Box>
      )
    case 'request':
      return RequestRow(index, row)
    case 'invite':
      return InviteRow(index, row)
    default:
      return DividerRow(index, row)
  }
}

export const RequestsAndInvites = (props: Props) => {
  return (
    <List
      items={props.requestsAndInvites}
      fixedHeight={48}
      keyProperty="key"
      renderItem={renderRequestsOrInvitesRow}
      style={{alignSelf: 'stretch'}}
    />
  )
}
