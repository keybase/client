// @flow
import * as React from 'react'
import {globalStyles, globalMargins} from '../../styles'
import {StandardScreen, Box, Button, Text} from '../../common-adapters'

type Props = {
  onDBNuke: () => void,
  onBack: () => void,
}

function DBNuke(props: Props) {
  return (
    <StandardScreen onBack={props.onBack}>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          flex: 1,
          padding: globalMargins.medium,
          paddingTop: globalMargins.xlarge,
          paddingBottom: globalMargins.medium,
        }}
      >
        <Text type="BodySemibold" style={{textAlign: 'center'}}>
          Please don't do anything here unless instructed to by a developer.
        </Text>
        <Button
          style={{marginTop: globalMargins.small}}
          type="Danger"
          label="DB Nuke"
          onClick={props.onDBNuke}
        />
        <Box style={{flex: 1}} />
      </Box>
    </StandardScreen>
  )
}

export default DBNuke
