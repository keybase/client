import * as React from 'react'
import {Box, Button, Text, ButtonBar} from '../../../common-adapters'
import {globalColors, globalStyles} from '../../../styles'
import {Props} from './you-rekey.types'

const YouRekey = ({onRekey}: Props) => {
  return (
    <Box style={containerStyle}>
      <Box style={{...globalStyles.flexBoxRow, backgroundColor: globalColors.red, justifyContent: 'center'}}>
        <Text
          negative={true}
          style={{paddingBottom: 8, paddingLeft: 24, paddingRight: 24, paddingTop: 8}}
          type="BodySemibold"
        >
          This conversation needs to be rekeyed.
        </Text>
      </Box>
      <ButtonBar>
        <Button backgroundColor="blue" onClick={onRekey} label="Rekey" />
      </ButtonBar>
    </Box>
  )
}

const containerStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  backgroundColor: globalColors.blueDarker2,
  flex: 1,
  justifyContent: 'flex-start',
}

export default YouRekey
