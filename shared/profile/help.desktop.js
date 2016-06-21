// @flow
import React from 'react'
import {Box, Text, Terminal, Icon, Avatar} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import {shell} from 'electron'

type Props = {
  username: string
};

const RenderHelp = ({username}: Props) => (
  <Box style={stylesScrollContainer}>
    <Box style={stylesContainer}>
      <Box style={styleIconHeader}>
        <Box style={styleIconWrapper}><Icon type='icon-fancy-bubbles-123-x-64' /></Box>
        <Box style={styleIconWrapper}><Avatar size={48} username={username} /></Box>
      </Box>
      <Box style={styleTextHeader}>
        <Text type='Body'>
          Until this tab is ready, you must use <Text
            type='BodyPrimaryLink'
            onClick={() => shell.openExternal(`https://keybase.io/${username}`)}>
            the website
          </Text> to edit your bio, full name, and location.
        </Text>
      </Box>
      <Box style={styleBody}>
        <Text type='BodySmall' style={{...styleBodyText}}>
          However, you can use the terminal to manage your keys and identity.
          When you run the commands below, you’ll see your <Text
            type='BodySmallPrimaryLink'
            onClick={() => shell.openExternal(`https://keybase.io/${username}/graph`)}>
            identity graph
          </Text> update on the site.
        </Text>
        <Terminal style={styleTerminal}>
          <Box style={{...styleTerminalGroups}}>
            <Text type='Terminal'>keybase prove twitter</Text>
            <Text type='Terminal'>keybase prove reddit</Text>
            <Text type='Terminal'>keybase help prove</Text>
            <Text type='Terminal'>keybase help pgp</Text>
            <Text type='Terminal'>keybase help sigs</Text>
            <Text type='Terminal'>keybase btc</Text>
          </Box>
          <Box style={{...styleTerminalGroups, marginLeft: '2em'}}>
            <Text type='TerminalComment'>prove twitter</Text>
            <Text type='TerminalComment'>prove reddit</Text>
            <Text type='TerminalComment'>prove other stuff</Text>
            <Text type='TerminalComment'>PGP key mgmt</Text>
            <Text type='TerminalComment'>manage existing proofs</Text>
            <Text type='TerminalComment'>add a bitcoin address</Text>
          </Box>
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
  position: 'relative',
}

const styleIconWrapper = {
  position: 'absolute',
  top: '50%',
  transform: 'translate(-50%, -50%)',
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
  ...globalStyles.flexBoxRow,
  borderRadius: 4,
  padding: 32,
  marginTop: 16,
  width: '100%',
  maxWidth: 576,
  minWidth: 490,
}

const styleTerminalGroups = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  textAlign: 'left',
}

export default RenderHelp
