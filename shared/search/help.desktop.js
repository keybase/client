// @flow
import React, {Component} from 'react'
import {Box, Text, Terminal} from '../common-adapters'
import {globalStyles, globalColors} from '../styles/style-guide'

type Props = {
  username: string
}

type State = {
  showingSoggyCheeto: boolean
}

class RenderHelp extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {
      showingSoggyCheeto: false,
    }
  }

  render () {
    if (this.state.showingSoggyCheeto) {
      return (
        <Box
          style={{
            backgroundSize: 'cover',
            flexGrow: 1,
          }}
          onClick={() => this.setState({showingSoggyCheeto: false})}
        />
      )
    }
    return (
      <Box style={stylesScrollContainer}>
        <Box style={stylesContainer}>
          <Box style={styleIconHeader}>
            // TODO (AW): add header icon
          </Box>
          <Box style={styleTextHeader}>
            <Text type='Body'>
              This tab is not <Text
                type='BodyPrimaryLink'
                onClick={() => this.setState({showingSoggyCheeto: true})}>
                fully cooked
              </Text> yet.
            </Text>
          </Box>
          <Box style={styleBody}>
            <Text type='BodySmall' style={{...styleBodyText}}>
              Until then, you have to use the terminal to search for and track users.
            </Text>
            <Text type='BodySmall' style={{...styleBodyText}}>
              <Text type='BodySmallSemibold'>Remember:</Text> you can look up people
              by any of their online aliases (twitter, reddit, github, etc.)
            </Text>
            <Terminal style={styleTerminal}>
              <Box style={{...styleTerminalKeybaseCommands}}>
                <Box style={{...styleTerminalGroups}}>
                  <Text type='Terminal'>keybase id maxtaco@twitter</Text>
                  <Text type='Terminal'>keybase id max</Text>
                  <Text type='Terminal'>keybase search "maxwell"</Text>
                  <Text type='Terminal'>keybase track max</Text>
                </Box>
                <Box style={{...styleTerminalGroups, marginLeft: '2em'}}>
                  <Text type='TerminalComment'>id by twitter name</Text>
                  <Text type='TerminalComment'>or keybase name</Text>
                  <Text type='TerminalComment'>search usernames</Text>
                  <Text type='TerminalComment'>track someone</Text>
                </Box>
              </Box>
              <Text type='TerminalEmpty' />
              <Text type='TerminalComment'>pro tip - you can write to KBFS encrypted folders</Text>
              <Text type='TerminalComment'>for people even *before* they join Keybase.</Text>
              <Text type='TerminalComment'>Your computer will rekey the folder automatically</Text>
              <Text type='TerminalComment'>when they join and establish keys.</Text>
              <Text type='TerminalEmpty' />
              <Text type='Terminal'>{`cd /keybase/private/${this.props.username},somefriend@twitter`}</Text>
              <Text type='TerminalEmpty' />
              <Text type='Terminal'>cp ~/pics.zip</Text>
            </Terminal>
          </Box>
        </Box>
      </Box>
    )
  }
}

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

const styleTerminalKeybaseCommands = {
  ...globalStyles.flexBoxRow,
}

const styleTerminalGroups = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
}

export default RenderHelp
