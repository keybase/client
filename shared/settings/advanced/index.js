// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {Box, Button, Text} from '../../common-adapters'

type Props = {
  onClearCache: () => void,
}

function ClearCache(props: Props) {
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
        onClick={props.onClearCache}
      />
      <Box style={{flex: 1}} />
    </Box>
  )
}

export default ClearCache
