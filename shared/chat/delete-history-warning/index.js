// @flow
import React from 'react'
import {Box, Button, HeaderHoc, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'

type Props = {
  errorText: string,
  name: string,
  onDeleteHistory: () => void,
  timestamp: string,
}

const DeleteHistoryWarning = ({errorText, name, timestamp, onDeleteHistory}: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      ...stylePadding,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: globalColors.white,
    }}
  >
    <Text type="Body">Are you sure you want to delete all messages before {timestamp} for everyone?</Text>
    <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xlarge}}>
      <Button type="Danger" style={{marginLeft: globalMargins.tiny}} onClick={onDeleteHistory} label="Yes" />
    </Box>
  </Box>
)

const stylePadding = isMobile
  ? {
      paddingTop: globalMargins.xlarge,
    }
  : {
      marginBottom: 80,
      marginLeft: 80,
      marginRight: 80,
      marginTop: 90,
    }

export default (isMobile ? HeaderHoc(DeleteHistoryWarning) : DeleteHistoryWarning)
