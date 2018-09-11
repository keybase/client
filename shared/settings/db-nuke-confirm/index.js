// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box, Button, Text, ButtonBar} from '../../common-adapters'

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
      <ButtonBar>
        <Button type="Secondary" label="Cancel" onClick={props.onCancel} />
        <Button type="Danger" label="Yes, blow it away" onClick={props.onDBNuke} />
      </ButtonBar>
    </Box>
  )
}

export default DBNukeConfirm
