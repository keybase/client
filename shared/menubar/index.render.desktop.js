/* @flow */
/*eslint-disable react/prop-types */ // Since we're using flow types for props

import React, {Component} from 'react'
import {shell} from 'electron'
import resolveRoot from '../../desktop/resolve-root'

import {intersperse} from '../util/arrays'
import {parseFolderNameToUsers, canonicalizeUsernames, stripPublicTag} from '../util/kbfs'

import {globalStyles, globalColors} from '../styles/style-guide'
import {Button, Text, Input, Terminal, Icon, ProgressIndicator} from '../common-adapters/index'

import {cleanup, allowLoggedOut as allowLoggedOutKBFS} from '../util/kbfs'

// This is the only data that the renderer cares about for a folder
import type {FolderInfo, FolderEntry, RenderProps} from './index.render'

import flags from '../util/feature-flags'

function iconPath (isPublic, isEmpty) {
  const pubPart = isPublic ? 'public' : 'private'
  const emptyPart = isEmpty ? 'empty' : 'full'
  return `file:///${resolveRoot(`shared/images/folders/kb-folder-${pubPart}-${emptyPart}.svg`)}`
}

const Header = props => {
  const openKBFS: () => void = props.openKBFS
  const showUser: () => void = props.showUser

  const version = __VERSION__ // eslint-disable-line no-undef

  return (
    <div style={styles.header}>
      <Icon hint='Open KBFS folder' type='fa-folder' style={{marginRight: 10}} onClick={openKBFS}/>
      <Icon hint='Open keybase.io web' type='fa-globe' onClick={showUser}/>
      <div style={{flex: 1}}/>
      <Icon hint={`Report a bug for version: ${version}`} type='fa-bug' onClick={() => {
        shell.openExternal(`https://github.com/keybase/client/issues/new?body=Keybase%20GUI%20Version:%20${encodeURIComponent(version)}`)
      }}/>
    </div>
  )
}

const Footer = props => {
  const showHelp: () => void = props.showHelp
  const quit: () => void = props.quit

  return (
    <div style={styles.footer}>
      <Text type='Body' small onClick={showHelp}>Help</Text>
      <Text type='Body' small onClick={quit}>Quit</Text>
    </div>
  )
}

const LogInTerminalMessage = props => {
  return (
    <div style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.black10}}>
      <Icon type='fa-exclamation-triangle' style={{alignSelf: 'center', color: globalColors.yellow, marginTop: 12}} />
      <Text type='Body' small style={{alignSelf: 'center', marginTop: 6}}>You're logged out!</Text>
      <Text type='Body' small style={{marginTop: 23, marginBottom: 5, marginLeft: 10}}>From the terminal:</Text>
      <Terminal>
        <Text type='TerminalCommand'>keybase login</Text>
        <Text type='TerminalEmpty'/>
        <Text type='TerminalComment'>or if you're new to Keybase:</Text>
        <Text type='TerminalCommand'>keybase signup</Text>
      </Terminal>
      {allowLoggedOutKBFS && <Text type='Body' small style={{marginTop: 22, marginBottom: 7, marginLeft: 10}}>Or access someone's public folder:</Text>}
    </div>
  )
}

const LogInPrompt = props => {
  const logIn: () => void = props.logIn
  return (
    <div style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.black10}}>
      <Icon type='fa-exclamation-triangle' style={{alignSelf: 'center', color: globalColors.yellow, marginTop: 12}} />
      <Text type='Body' small style={{alignSelf: 'center', marginTop: 6}}>You're logged out!</Text>
      <Button type='Primary' label='Log In' onClick={logIn} style={{alignSelf: 'center', minWidth: 160, marginTop: 12, marginRight: 0}}/>
      {allowLoggedOutKBFS && <Text type='Body' small style={{marginTop: 22, marginBottom: 7, marginLeft: 10}}>Or access someone's public folder:</Text>}
    </div>
  )
}

export default class Render extends Component {
  props: RenderProps;

  render () {
    const {openKBFS, openKBFSPublic, openKBFSPrivate, showMain,
      showHelp, showUser, logIn, quit, username, loggedIn} = this.props

    return (
      <div style={styles.container}>
        <div style={styles.body}>
          <Header openKBFS={openKBFS} showUser={() => showUser(username)}/>
          {!loggedIn && (flags.login ? <LogInPrompt logIn={logIn} /> : <LogInTerminalMessage />)}
          <FolderList loading={this.props.loading} username={this.props.username} openKBFSPublic={openKBFSPublic} openKBFSPrivate={openKBFSPrivate} folders={this.props.folders} loggedIn={loggedIn}/>
          <Footer showHelp={showHelp} quit={quit} showMain={showMain}/>
        </div>
      </div>
    )
  }
}

const Row = props => {
  const wrapStyle = props.allowWrap ? {flexWrap: 'wrap'} : {}
  const containerStyle = {
    ...globalStyles.flexBoxRow,
    alignItems: 'flex-start',
    marginTop: 1,
    marginBottom: 1,
    minHeight: 25,
    ...props.style,
    ...wrapStyle
  }

  return (
    <div style={containerStyle} onClick={props.onClick}>
      <div style={{...globalStyles.clickable, marginRight: 2, ...props.iconStyle}}/>
      <Text type='Body' link small key={props.key} style={{marginTop: 4, overflowWrap: 'break-word', flex: 1, ...props.textStyle}}>{props.text}</Text>
      {props.children}
    </div>
  )
}

const FolderRow = props => {
  const divider = <span>,<wbr/></span> // word break on the commas
  const {username, folder: {isPublic, isEmpty, openFolder, folderName}} = props
  let text = intersperse(divider, canonicalizeUsernames(username, parseFolderNameToUsers(folderName)))

  return <Row
    onClick={openFolder}
    text={text}
    allowWrap
    iconStyle={SVGFolderIcon(iconPath(isPublic, isEmpty))}
    textStyle={{color: globalColors.blue}}
    key={isPublic + text.join('')}/>
}

const FolderEntryRow = props => {
  const {key, entry} = props
  let inputRef = null

  const openFolder = () => {
    if (inputRef) {
      entry.openFolder(cleanup(inputRef.getValue()))
      inputRef.clearValue()
      inputRef.blur()
    }
  }

  return (
    <Row
      style={{height: 25, position: 'relative'}}
      onClick={() => {}}
      text={entry.prefix}
      iconStyle={SVGFolderIcon(iconPath(entry.isPublic, false))}
      textStyle={{color: globalColors.blue}}
      key={key}>
      <Input
        ref={input => (inputRef = input)}
        small
        hintStyle={styles.dz1InputHint}
        hintText='user1,user2,etc'
        onEnterKeyDown={() => openFolder()}
        style={{width: '100%', marginLeft: entry.prefix ? 2 : 0, textAlign: 'left'}} />
      <i className='fa fa-arrow-right' style={styles.entryArrow} onClick={() => openFolder()}></i>
    </Row>)
}

const ShowAll = props => {
  return <Row
    onClick={props.onClick}
    text='Show All'
    iconStyle={{...SVGFolderIcon(`file:///${resolveRoot('shared/images/see-more.svg')}`), marginTop: 2}}
    textStyle={{}}
    key={props.isPublic + 'showAll'}/>
}

type CollapsableFolderListProps = {
    username: ?string;
    folders: Array<FolderInfo|FolderEntry>;
    folderDisplayLimit: number;
    collapsed: boolean;
    onExpand: Function;
    isPublic: boolean;
}

// No Idea why I can't just do props like before, but this works too
class CollapsableFolderList extends Component<void, CollapsableFolderListProps, void> {
  render () {
    const {collapsed, username, folderDisplayLimit, onExpand} = this.props

    let {folders} = this.props
    // Check if it's bigger by one because it's pointless to have a button
    // that says show all for just one more thing
    let truncated = false
    if (collapsed && folders.length > folderDisplayLimit + 1) {
      folders = folders.slice(0, folderDisplayLimit)
      truncated = true
    }

    return (
      <div style={{...globalStyles.flexBoxColumn, marginLeft: 10, marginBottom: 4, justifyContent: 'flex-start'}}>
        {folders.map(f => {
          const key = f.type === 'entry' ? `entry${f.prefix}` : `${f.isPublic}:${f.folderName}`

          if (f.type === 'entry') {
            return <FolderEntryRow key={key} entry={f} />
          } else {
            return <FolderRow key={key} username={username} folder={f}/>
          }
        })}
        {truncated && <ShowAll onClick={onExpand} isPublic={this.props.isPublic} />}
      </div>
    )
  }
}

type FolderListProps = {
  loading: boolean,
  username: ?string,
  folders: Array<FolderInfo>,
  openKBFSPublic: (username: ?string) => void,
  openKBFSPrivate: (username: ?string) => void,
  loggedIn: boolean
}

type FolderState = {
  privateCollapsed: boolean,
  publicCollapsed: boolean
}

// No idea why I have to specify the props and state here instead of props: {...};
class FolderList extends Component<void, FolderListProps, FolderState> {
  state: FolderState;

  constructor (props) {
    super(props)
    this.state = {
      privateCollapsed: true,
      publicCollapsed: true
    }
  }

  render () {
    const {username, loggedIn} = this.props

    if (!loggedIn && !allowLoggedOutKBFS) {
      return <div style={{flex: 1, backgroundColor: globalColors.black10}}/>
    }

    // Remove folders that are just our personal ones, we'll add those in later
    // For consistency. Since we aren't gauranteed we have favorited our own folders.
    const folders = this.props.folders.filter(f => f.type === 'entry' || stripPublicTag(f.folderName) !== username)

    let privateFolders = []
    let publicFolders = []

    if (loggedIn && username) {
      const personalPrivateFolder: FolderInfo = {
        type: 'folder',
        folderName: username,
        isPublic: false,
        isEmpty: true,
        openFolder: () => this.props.openKBFSPrivate(username)
      }
      privateFolders.push(personalPrivateFolder)

      const privateFolderEntry: FolderEntry = {
        type: 'entry',
        isPublic: false,
        prefix: `${username},`,
        openFolder: folder => this.props.openKBFSPrivate(`${username},${folder}`)
      }
      privateFolders.push(privateFolderEntry)
    }

    if (loggedIn && username) {
      const personalPublicFolder: FolderInfo = {
        type: 'folder',
        folderName: username,
        isPublic: true,
        isEmpty: true,
        openFolder: () => this.props.openKBFSPublic(username)
      }

      publicFolders.push(personalPublicFolder)
    }

    const publicFolderEntry: FolderEntry = {
      type: 'entry',
      isPublic: true,
      prefix: '',
      openFolder: folder => this.props.openKBFSPublic(folder)
    }

    publicFolders.push(publicFolderEntry)

    privateFolders = privateFolders.concat(folders.filter(f => !f.isPublic))
    publicFolders = publicFolders.concat(folders.filter(f => f.isPublic)).map(f => f.type === 'entry'
      ? f : {...f, folderName: stripPublicTag(f.folderName)})

    const folderDisplayLimit = 5

    return (
      <div style={{...styles.folderList, overflowY: loggedIn ? 'scroll' : 'hidden'}}>
        {this.props.loading && (
          <div style={styles.loader}>
            <ProgressIndicator style={styles.loader} />
          </div>)}
        {!!privateFolders.length && (
          <div>
            <Text type='Body' onClick={() => this.props.openKBFSPrivate('')}>/keybase/private/</Text>
            <CollapsableFolderList
              username={username}
              folders={privateFolders}
              folderDisplayLimit={folderDisplayLimit}
              onExpand={() => this.setState({privateCollapsed: false})}
              isPublic={false}
              collapsed={this.state.privateCollapsed} />
          </div>
        )}
        <Text type='Body' onClick={() => this.props.openKBFSPublic('')}>/keybase/public/</Text>
        <CollapsableFolderList
          username={username}
          folders={publicFolders}
          folderDisplayLimit={folderDisplayLimit}
          onExpand={() => this.setState({publicCollapsed: false})}
          isPublic
          collapsed={this.state.publicCollapsed} />
      </div>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    flex: 1
  },
  body: {
    ...globalStyles.flexBoxColumn,
    position: 'relative',
    overflow: 'hidden',
    height: 364,
    minHeight: 364,
    maxHeight: 364,
    flex: 1
  },
  header: {
    ...globalStyles.flexBoxRow,
    backgroundColor: globalColors.lightGrey,
    minHeight: 31,
    maxHeight: 32,
    padding: 10
  },
  folderHeader: {
    ...globalStyles.flexBoxRow,
    justifyContent: 'space-between',
    paddingRight: 18
  },
  folderList: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColors.white,
    position: 'relative',
    flex: 1,
    padding: 10,
    overflowY: 'scroll',
    overflowX: 'hidden'
  },
  loader: {
    position: 'absolute',
    alignSelf: 'center',
    width: 30,
    top: 0,
    right: 0,
    opacity: 0.8
  },
  footer: {
    ...globalStyles.flexBoxRow,
    backgroundColor: globalColors.lightGrey,
    justifyContent: 'space-between',
    padding: 10
  },
  personalTLDStyle: {
    fontSize: 15,
    lineHeight: '18px',
    color: globalColors.blue2
  },
  showAllBox: {
    color: globalColors.white,
    ...globalStyles.fontBold,
    fontSize: 8,
    backgroundColor: globalColors.lightGrey3,
    minWidth: 16,
    minHeight: 11,
    borderRadius: 2,
    alignSelf: 'center',
    marginRight: 8
  },
  entryArrow: {
    ...globalStyles.clickable,
    color: globalColors.lightGrey2,
    width: 25,
    fontSize: 13,
    height: 25,
    textAlign: 'center',
    position: 'absolute',
    right: 0,
    top: 5
  },
  dz1InputHint: {
    color: globalColors.black,
    // This is because normal <Input/> does center-aligned hints by using
    // width: 100% on position: absolute
    width: 'auto',
    marginTop: 0
  }
}

const SVGFolderIcon = svgPath => ({
  height: 22,
  minWidth: 22,
  maxWidth: 22,
  backgroundImage: `url(${svgPath})`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'center center'
})
