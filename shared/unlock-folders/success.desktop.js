// @flow
import * as React from 'react'
import {globalStyles} from '../styles'
import {Text, Button, Icon, Box, ButtonBar} from '../common-adapters'

const PaperKeyInput = ({onClose}: {onClose: () => void}) => (
  <div style={containerStyle}>
    <Icon type="icon-folders-private-success-48" />
    <Box style={globalStyles.flexBoxColumn}>
      <Text center={true} type="BodySemibold">
        Success!
      </Text>
      <Text center={true} style={{paddingLeft: 40, paddingRight: 40}} type="Body">
        Your paper key is now rekeying folders for this computer. It takes just a couple minutes but lasts
        forever, like the decision to have a child
      </Text>
    </Box>
    <ButtonBar>
      <Button type="Primary" label="Okay" onClick={onClose} />
    </ButtonBar>
  </div>
)

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  bottom: 30,
  justifyContent: 'space-between',
  left: 0,
  position: 'absolute',
  right: 0,
  top: 40,
}

export default PaperKeyInput
