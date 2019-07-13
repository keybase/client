import React from 'react'
import {Box, Button, HeaderOnMobile, Icon, MaybePopup, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile, platformStyles} from '../../styles'

type Props = {
  onBack: (() => void)| null
  onCancel: () => void
  onDeleteHistory: () => void
}

const DeleteHistoryWarning = ({onCancel, onDeleteHistory}: Props) => (
  <MaybePopup onClose={onCancel}>
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        ...stylePadding,
        alignItems: 'center',
        backgroundColor: globalColors.white,
        justifyContent: 'center',
        maxWidth: 560,
        padding: globalMargins.small,
      }}
    >
      <Icon type={isMobile ? 'icon-message-deletion-64' : 'icon-message-deletion-48'} />
      <Text style={{padding: globalMargins.small}} type="Header">
        Delete conversation history?
      </Text>
      <Text center={isMobile} style={styleText} type="Body">
        You are about to delete all the messages in this conversation. For everyone.
      </Text>
      <Box style={styleButtonBox}>
        <Button type="Dim" style={styleButton} onClick={onCancel} label="Cancel" fullWidth={isMobile} />
        <Button
          type="Danger"
          style={styleButton}
          onClick={onDeleteHistory}
          label="Yes, clear for everyone"
          fullWidth={isMobile}
        />
      </Box>
    </Box>
  </MaybePopup>
)

const stylePadding = platformStyles({
  isElectron: {
    marginBottom: 40,
    marginLeft: 80,
    marginRight: 80,
    marginTop: 40,
  },
  isMobile: {paddingTop: globalMargins.xlarge},
})

const styleButtonBox = platformStyles({
  common: {marginTop: globalMargins.xlarge},
  isElectron: {...globalStyles.flexBoxRow},
  isMobile: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'column-reverse',
    paddingTop: globalMargins.xlarge,
    width: '100%',
  },
})

const styleButton = platformStyles({
  isElectron: {marginLeft: globalMargins.tiny},
  isMobile: {marginTop: globalMargins.tiny},
})

const styleText = {padding: globalMargins.small}

export default HeaderOnMobile(DeleteHistoryWarning)
