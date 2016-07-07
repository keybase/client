// @flow
import React from 'react'
import {Box, Text, Terminal, Icon} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'
import {shell} from 'electron'

type Props = {
  username: string
}

const RenderHelp = ({username}: Props) => (
  <Box style={stylesScrollContainer}>
    <Box style={stylesContainer}>
      <Box style={styleIconHeader}>
        <Icon type='icon-fancy-folders-138-x-48' />
      </Box>
      <Box style={styleTextHeader}>
        <Text type='Body'>
          Soon, this is where you'll manage and learn about folders in the Keybase
          filesystem. It will be <Text
            type='BodyPrimaryLink'
            onClick={() => shell.openExternal('https://www.youtube.com/watch?v=kTOvzgNsOXw')}>
            incredibly powerful
          </Text> when finished.
        </Text>
      </Box>
      <Box style={styleBody}>
        <Text type='BodySmall' style={{...styleBodyText}}>
          Here are a few terminal examples in the meantime. Note you can share with
          people who haven't joined Keybase yet, and your computer will rekey the
          data for them the moment they establish keys.
        </Text>
        <Text type='BodySmall' style={{...styleBodyText, ...globalStyles.italic}}>
          True end-to-end crypto.
        </Text>
        <Terminal style={styleTerminal}>
          <Text type='Terminal'>{`cd /keybase/public/${username}`}</Text>
          <Text type='Terminal'>{`cd /keybase/private/${username}`}</Text>
          <Text type='Terminal'>{`cd /keybase/private/${username},chris`}</Text>
          <Text type='TerminalEmpty' />
          <Text type='TerminalComment'>works even before maxtaco@twitter has joined keybase:</Text>
          <Text type='Terminal'>{`cd /keybase/private/${username},maxtaco@twitter`}</Text>
          <Text type='TerminalEmpty' />
          <Text type='TerminalComment'>OSX tip: this opens Finder</Text>
          <Text type='Terminal'>{`open /keybase/private/${username}`}</Text>
          <Text type='TerminalEmpty' />
          <Text type='TerminalComment'>to hide a folder in your Finder</Text>
          <Text type='Terminal'>{`rmdir /keybase/private/${username},some_enemy`}</Text>
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
