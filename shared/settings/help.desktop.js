// @flow
import React from 'react'
import {Box, Text, Terminal, Icon} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'

const RenderHelp = () => (
  <Box style={stylesScrollContainer}>
    <Box style={stylesContainer}>
      <Box style={styleIconHeader}>
        <Icon type='icon-fancy-settings-64' />
      </Box>
      <Box style={styleTextHeader}>
        <Text type='Body'>
          There are no GUI settings for Keybase right now. This app is perfect.
          But soon, once the bloat sets in, who knows.
        </Text>
      </Box>
      <Box style={styleBody}>
        <Text type='BodySmall' style={{...styleBodyText}}>
          Terminal commands:
        </Text>
        <Terminal style={styleTerminal}>
          <Text type='Terminal'>keybase passphrase [change|recover]</Text>
          <Text type='Terminal'>keybase deprovision <Text type='TerminalComment'>deprovision this install</Text></Text>
          <Text type='Terminal'>keybase help</Text>
          <Text type='TerminalComment'>etc.</Text>
        </Terminal>
      </Box>
    </Box>
  </Box>
)

const stylesScrollContainer = {
  ...globalStyles.scrollable,
  flexGrow: 1,
  background: globalColors.lightGrey,
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  textAlign: 'center',
  background: globalColors.white,
}

const styleIconHeader = {
  marginTop: 64,
  height: 80,
  marginBottom: 16,
  ...globalStyles.flexBoxColumn,
  justifyContent: 'center',
}

const styleTextHeader = {
  maxWidth: 512,
  marginLeft: 4,
  marginRight: 4,
  marginBottom: 32,
}

const styleBody = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  textAlign: 'center',
  flexGrow: 1,
  background: globalColors.lightGrey,
  padding: 32,
  width: '100%',
}

const styleBodyText = {
  maxWidth: 512,
}

const styleTerminal = {
  borderRadius: 4,
  padding: 32,
  marginTop: 16,
  width: '100%',
  maxWidth: 576,
}

export default RenderHelp
