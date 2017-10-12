// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box, Button, Text} from '../../common-adapters'

type Props = {
  onDBNuke: () => void,
}

function DBNuke(props: Props) {
  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        alignItems: 'center',
        flex: 1,
        padding: globalMargins.medium,
        paddingTop: globalMargins.xlarge,
        paddingBottom: globalMargins.xlarge,
      }}
    >
      <Text type="Body" style={{textAlign: 'center', padding: globalMargins.small}}>
        Don't do anything here unless instructed to by a developer.
      </Text>
      <Button
        style={{marginTop: globalMargins.small}}
        type="Danger"
        label="Clear cache"
        onClick={props.onDBNuke}
      />
      <Box style={{flex: 1}} />
    </Box>
  )
}

export default DBNuke
