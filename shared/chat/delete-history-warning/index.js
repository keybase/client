// @flow
import React from 'react'
import {Box, Button, HeaderOnMobile, Icon, MaybePopup, Text} from '../../common-adapters'
import {globalColors, globalMargins, globalStyles, isMobile, platformStyles} from '../../styles'

type Props = {|
  onBack: ?() => void,
  onCancel: () => void,
  onDeleteHistory: () => void,
|}

const DeleteHistoryWarning = ({onCancel, onDeleteHistory}: Props) => (
  <MaybePopup onClose={onCancel}>
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
      <Text style={styleText} type="Body">
        You are about to delete all the messages in this conversation. For everyone.
      </Text>
      <Box style={styleButtonBox}>
        <Button type="Secondary" style={styleButton} onClick={onCancel} label="Cancel" fullWidth={isMobile} />
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
    flex: 1,
    alignItems: 'stretch',
    width: '100%',
    flexDirection: 'column-reverse',
    paddingTop: globalMargins.xlarge,
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

const styleText = platformStyles({
  common: {
    padding: globalMargins.small,
  },
  isMobile: {
    textAlign: 'center',
  },
})

export default HeaderOnMobile(DeleteHistoryWarning)
