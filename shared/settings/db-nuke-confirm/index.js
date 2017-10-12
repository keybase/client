// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box, Button, Text} from '../../common-adapters'

export type Props = {
  onCancel: () => void,
  onDBNuke: () => void,
}

function DBNukeConfirm(props: Props) {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        padding: globalMargins.medium,
      }}
    >
      <Text type="Header" style={{marginTop: globalMargins.medium, width: 320, textAlign: 'center'}}>
        Are you sure you want to blast away your local database?
      </Text>
      <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.medium}}>
        <Button type="Secondary" label="Cancel" onClick={props.onCancel} />
        <Button
          style={{margin: 0, marginLeft: globalMargins.tiny}}
          type="Danger"
          label="Yes, blow it away"
          onClick={props.onDBNuke}
        />
      </Box>
    </Box>
  )
}

export default DBNukeConfirm
