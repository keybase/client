// @flow
import React from 'react'
import {BackButton, Box, Text} from '../../common-adapters'
import {globalStyles, globalColors, platformStyles} from '../../styles'
import {fileUIName} from '../../constants/platform'

type Props = {
  back: () => void,
  openSecurityPrefs: () => void,
  needAction: boolean,
}

const InstallSecurityPrefs = (props: Props) => props.needAction ? (
  <Box style={stylesContainer}>
    <BackButton key="back" onClick={props.back} style={stylesClose} />
    <Text type="HeaderBig" style={{paddingBottom: 13, paddingTop: 10}}>
      Ghhh. Try this.
    </Text>
    <Text type="Body" style={{paddingBottom: 24}}>
      Open your macOS Security & Privacy Settings and follow these steps.
    </Text>
    <Box style={{...globalStyles.flexBoxRow, marginRight: 20}}>
      <Box style={{position: 'relative'}}>
        <img width={500} height={437} src={/* TODO: fix image sourcing */require('../../images/install/security-preferences.png')} />
        <Box
          style={{...styleHighlight, height: 30, left: 42, position: 'absolute', top: 350, width: 162}}
        />
        <Text type="BodySemibold" style={{...stylesNumberList, left: 72, position: 'absolute', top: 374}}>
          1
        </Text>
        <Box
          style={{...styleHighlight, height: 30, left: 352, position: 'absolute', top: 282, width: 94}}
        />
        <Text
          type="BodySemibold"
          style={{...stylesNumberList, left: 432, position: 'absolute', top: 302}}
        >
          2
        </Text>
      </Box>
      <Box style={{...globalStyles.flexBoxColumn, marginTop: 30}}>
        <Box style={globalStyles.flexBoxRow}>
          <Text type="BodySemibold" style={stylesNumberList}>
            1
          </Text>
          <Text type="BodySemibold" style={styleListText}>
            Click the lock icon then enter your password
          </Text>
        </Box>
        <Box style={globalStyles.flexBoxRow}>
          <Text type="BodySemibold" style={stylesNumberList}>
            2
          </Text>
          <Text type="BodySemibold" style={styleListText}>
            Click "Allow"
          </Text>
        </Box>
        <Text
          type="BodySemiboldLink"
          style={{fontSize: 14, paddingTop: 20}}
          onClick={props.openSecurityPrefs}
        >
          Open Security & Privacy Settings
        </Text>
      </Box>
    </Box>
  </Box>
) : (
  <Box style={stylesContainer}>
    <BackButton key="back" onClick={props.back} style={stylesClose} />
    <Text type="HeaderBig" style={{paddingBottom: 13, paddingTop: 10}}>
      Success! Your Keybase folders will appear in your {fileUIName} now.
      { /* TODO: implement the rest of design */ }
    </Text>
  </Box>
)

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  height: '100%',
  justifyContent: 'center',
  overflowY: 'auto',
  position: 'relative',
}

const stylesNumberList = platformStyles({
  isElectron: {
    backgroundColor: globalColors.blue,
    borderRadius: '50%',
    color: globalColors.white,
    height: 20,
    marginRight: 13,
    minWidth: 20,
    paddingTop: 1,
    textAlign: 'center',
    width: 20,
  },
})

const styleListText = {
  paddingBottom: 16,
  paddingTop: 1,
}

const styleHighlight = {
  backgroundColor: globalColors.black_05,
  borderColor: globalColors.blue,
  borderRadius: 100,
  borderStyle: 'solid',
  borderWidth: 2,
}

const stylesClose = {
  left: 10,
  position: 'absolute',
  top: 10,
}

export default InstallSecurityPrefs
