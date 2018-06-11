// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box, Button, Text} from '../../common-adapters'

import type {Props} from './index'

function DeleteMe(props: Props) {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
      }}
    >
      <Text type="Header" style={{marginTop: globalMargins.medium}}>
        So this is goodbye?
      </Text>
      <Text type="Body" style={{textAlign: 'center', padding: globalMargins.small, maxWidth: 440}}>
        If you delete your account, you can't get it back, and you can't create another account with the same
        name.
      </Text>
      <Button
        style={{marginTop: globalMargins.small}}
        type="Danger"
        label="Delete my account forever"
        onClick={props.onDelete}
      />
    </Box>
  )
}

export default DeleteMe
