// @flow
import React from 'react'
import {Box, Button, HeaderOnMobile, Icon, MaybePopup, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile, platformStyles} from '../../styles'

type Props = {
  errorText: string,
  name: string,
  onBack: () => void,
  onDeleteHistory: () => void,
}

const DeleteHistoryWarning = ({errorText, name, onBack, onDeleteHistory}: Props) => (
  <MaybePopup onClose={onBack}>
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        ...stylePadding,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: globalColors.white,
        padding: globalMargins.small,
        maxWidth: 560,
      }}
    >
      <Icon type={isMobile ? 'icon-message-deletion-64' : 'icon-message-deletion-48'} />
      <Text style={{padding: globalMargins.small}} type="Header">
        Delete conversation history?
      </Text>
      <Text style={{padding: globalMargins.small}} type="Body">
        You are about to delete all the messages in this conversation. For everyone.
      </Text>
      <Box style={styleButtonBox}>
        <Button type="Secondary" style={styleButton} onClick={onBack} label="Cancel" />
        <Button type="Danger" style={styleButton} onClick={onDeleteHistory} label="Yes, clear for everyone" />
      </Box>
    </Box>
  </MaybePopup>
)

const stylePadding = platformStyles({
  isMobile: {
    paddingTop: globalMargins.xlarge,
  },
  isElectron: {
    marginBottom: 40,
    marginLeft: 80,
    marginRight: 80,
    marginTop: 40,
  },
})

const styleButtonBox = platformStyles({
  common: {
    marginTop: globalMargins.xlarge,
  },
  isMobile: {
    ...globalStyles.flexBoxColumn,
  },
  isElectron: {
    ...globalStyles.flexBoxRow,
  },
})

const styleButton = platformStyles({
  isElectron: {
    marginLeft: globalMargins.tiny,
  },
  isMobile: {
    marginTop: globalMargins.tiny,
  },
})

export default HeaderOnMobile(DeleteHistoryWarning)
