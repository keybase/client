// @flow
import React from 'react'
import {Box, Button, HeaderOnMobile, Icon, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile} from '../../styles'

type Props = {
  errorText: string,
  name: string,
  onBack: () => void,
  onDeleteHistory: () => void,
  timestamp: string,
}

const DeleteHistoryWarning = ({errorText, name, onBack, timestamp, onDeleteHistory}: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      ...stylePadding,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: globalColors.white,
      padding: globalMargins.small,
    }}
  >
    <Icon type={isMobile ? 'icon-message-deletion-64' : 'icon-message-deletion-48'} />
    <Text style={{padding: globalMargins.small}} type="Header">
      Delete this message + everything above?
    </Text>
    <Text style={{padding: globalMargins.small}} type="Body">
      You are about to delete <Text type="BodySemibold">all messages up to {timestamp}</Text>. For everyone.
    </Text>
    <Box style={{...globalStyles.flexBoxRow, marginTop: globalMargins.xlarge}}>
      <Button type="Secondary" style={{marginLeft: globalMargins.tiny}} onClick={onBack} label="Cancel" />
      <Button
        type="Danger"
        style={{marginLeft: globalMargins.tiny}}
        onClick={onDeleteHistory}
        label="Yes, delete these messages"
      />
    </Box>
  </Box>
)

const stylePadding = isMobile
  ? {
      paddingTop: globalMargins.xlarge,
    }
  : {
      marginBottom: 40,
      marginLeft: 80,
      marginRight: 80,
      marginTop: 40,
    }

export default HeaderOnMobile(DeleteHistoryWarning)
