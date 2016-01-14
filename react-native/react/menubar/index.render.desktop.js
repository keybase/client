/* @flow */
/*eslint-disable react/prop-types */ // Since we're using flow types for props

import React, {Component} from '../base-react'
import {clipboard, shell} from 'electron'
import resolveAssets from '../../../desktop/resolve-assets'

import {intersperse} from '../util/arrays'
import {parseFolderNameToUsers, canonicalizeUsernames, stripPublicTag} from '../util/kbfs'

import {globalStyles, globalColors} from '../styles/style-guide'
import {Text, Input, Terminal, Icon} from '../common-adapters/index.desktop.js'

import {CircularProgress} from 'material-ui'
import {cleanup, allowLoggedOut as allowLoggedOutKBFS} from '../util/kbfs'
// TODO use this instead of notification after merging
// import {NotifyPopup} from '../native/notifications'

// This is the only data that the renderer cares about for a folder
import type {FolderInfo} from './index.render'

function iconPath (isPublic, isEmpty) {
  const pubPart = isPublic ? 'public' : 'private'
  const emptyPart = isEmpty ? 'empty' : 'full'
  return 'file:///' + resolveAssets(`../react-native/react/images/folders/kb-folder-${pubPart}-${emptyPart}.svg`)
}

const Header = props => {
  const openKBFS: () => void = props.openKBFS
  const showUser: () => void = props.showUser

  // $FlowIssue ignore
  const version = __VERSION__ // eslint-disable-line no-undef

  return (
    <div style={styles.header}>
      <Icon hint='Open KBFS folder' type='fa-folder' style={{marginRight: 10}} onClick={openKBFS}/>
      <Icon hint='Open keybase.io web' type='fa-globe' onClick={showUser}/>
      <div style={{flex: 1}}/>
      <Icon hint={`Report a bug for version: ${version}`} type='fa-bug' onClick={ () => {
        clipboard.writeText(`Keybase GUI Version: ${version}`)
        shell.openExternal('https://github.com/keybase/client/issues')
        new Notification('Version copied to clipboard')
        //NotifyPopup('Version copied to clipboard')
      }}/>
    </div>
  )
}

const Footer = props => {
  const debug: boolean = props.debug
  const showHelp: () => void = props.showHelp
  const showMain: () => void = props.showMain
  const quit: () => void = props.quit

  return (
    <div style={styles.footer}>
      <Text type='Body' small onClick={showHelp}>Help</Text>
      {debug && <Text type='Body' small onClick={showMain}>Debug</Text>}
      <Text type='Body' small onClick={quit}>Quit</Text>
    </div>
  )
}

const LoggedoutMessage = props => {
  return (
    <div style={{...globalStyles.flexBoxColumn, backgroundColor: globalColors.grey5}}>
      <i style={{alignSelf: 'center', color: globalColors.lowRiskWarning, marginTop: 12}} className='fa fa-exclamation-triangle'></i>
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

export default class Render extends Component {
  props: {
    username: ?string,
    openKBFS: () => void,
    openKBFSPublic: (username: ?string) => void,
    openKBFSPrivate: (username: ?string) => void,
    showMain: () => void,
    showHelp: () => void,
    showUser: (username: ?string) => void,
    quit: () => void,
    openingButtonInfo: {
      text: string,
      onClick: () => void
    },
    folders: Array<FolderInfo>,
    debug?: boolean,
    loading: boolean
  };

  render (): ReactElement {
    const {openKBFS, openKBFSPublic, openKBFSPrivate, showMain, showHelp, showUser, quit, username} = this.props

    return (
      <div style={styles.container}>
        <div style={styles.arrow}/>
        <div style={styles.body}>
          <Header openKBFS={openKBFS} showUser={() => showUser(username)}/>
          {!this.props.username && <LoggedoutMessage />}
          <FolderList loading={this.props.loading} username={this.props.username} openKBFSPublic={openKBFSPublic} openKBFSPrivate={openKBFSPrivate} folders={this.props.folders}/>
          <Footer debug={this.props.debug || false} showHelp={showHelp} quit={quit} showMain={showMain}/>
        </div>
      </div>
    )
  }
}

const Row = props => {
  return (
    <div style={{...globalStyles.flexBoxRow, alignItems: 'flex-start', marginTop: 1, marginBottom: 1, minHeight: 25, ...props.style}} onClick={props.onClick}>
      <div style={{...globalStyles.clickable, marginRight: 2, ...props.iconStyle}}/>
      <Text type='Body' link small key={props.key} style={{marginTop: 4, ...props.textStyle}}>{props.text}</Text>
      {props.children}
    </div>
  )
}

const FolderRow = props => {
  const {username, folder: {isPublic, isEmpty, openFolder, folderName}} = props
  let line = intersperse(',', canonicalizeUsernames(username, parseFolderNameToUsers(folderName)))

  return <Row
    onClick={openFolder}
    text={line}
    iconStyle={SVGFolderIcon(iconPath(isPublic, isEmpty))}
    textStyle={{color: globalColors.blue}}
    key={isPublic + line}/>
}

const FolderEntry = props => {
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
      ref={input => inputRef = input}
      small
      hintText='user1,user2,etc'
      onEnterKeyDown={() => openFolder()}
      style={{width: '100%', marginLeft: entry.prefix ? 2 : 0}} />
    <i className='fa fa-arrow-right' style={styles.entryArrow} onClick={() => openFolder()}></i>
  </Row>)
}

const ShowAll = props => {
  return <Row
    onClick={props.onClick}
    text='Show All'
    iconStyle={{...SVGFolderIcon('file:///' + resolveAssets(`../react-native/react/images/see-more.svg`)), marginTop: 2}}
    textStyle={{}}
    key={props.isPublic + 'showAll'}/>
}

class CollapsableFolderList extends Component {
  props: {
    username: ?string,
    folders: Array<FolderInfo>,
    folderDisplayLimit: number,
    collapsed: boolean,
    onExpand: Function,
    isPublic: boolean
  };

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
            return <FolderEntry key={key} entry={f} />
          } else {
            return <FolderRow key={key} username={username} folder={f}/>
          }
        })}
        {truncated && <ShowAll onClick={onExpand} isPublic={this.props.isPublic} />}
      </div>
    )
  }
}

class FolderList extends Component {
  props: {
    loading: boolean,
    username: ?string,
    folders: Array<FolderInfo>,
    openKBFSPublic: (username: ?string) => void,
    openKBFSPrivate: (username: ?string) => void
  };

  state: {
    privateCollapsed: boolean,
    publicCollapsed: boolean
  };

  constructor (props) {
    super(props)
    this.state = {
      privateCollapsed: true,
      publicCollapsed: true
    }
  }

  render () {
    const {username} = this.props

    if (!this.props.username && !allowLoggedOutKBFS) {
      return <div style={{flex: 1, backgroundColor: globalColors.grey5}}/>
    }

    // Remove folders that are just our personal ones, we'll add those in later
    // For consistency. Since we aren't gauranteed we have favorited our own folders.
    const folders = this.props.folders.filter(f => f.type === 'entry' || stripPublicTag(f.folderName) !== username)

    let privateFolders = []
    let publicFolders = []

    if (username) {
      const personalPrivateFolder: FolderInfo = {
        type: 'folder',
        folderName: username,
        isPublic: false,
        isEmpty: true,
        openFolder: () => this.props.openKBFSPrivate(username)
      }
      privateFolders.push(personalPrivateFolder)

      const privateFolderEntry: FolderInfo = {
        type: 'entry',
        isPublic: false,
        prefix: `${username},`,
        openFolder: folder => this.props.openKBFSPrivate(`${username},${folder}`)
      }
      privateFolders.push(privateFolderEntry)
    }

    if (username) {
      const personalPublicFolder: FolderInfo = {
        type: 'folder',
        folderName: username,
        isPublic: true,
        isEmpty: true,
        openFolder: () => this.props.openKBFSPublic(username)
      }

      publicFolders.push(personalPublicFolder)
    }

    const publicFolderEntry: FolderInfo = {
      type: 'entry',
      isPublic: true,
      prefix: '',
      openFolder: folder => this.props.openKBFSPublic(folder)
    }

    publicFolders.push(publicFolderEntry)

    privateFolders = privateFolders.concat(folders.filter(f => !f.isPublic))
    publicFolders = publicFolders.concat(
    folders.filter(f => f.isPublic))
    .map(f => f.type === 'entry' ? f : {...f, folderName: stripPublicTag(f.folderName)})

    const folderDisplayLimit = 5

    return (
      <div style={{...styles.folderList, overflowY: username ? 'scroll' : 'hidden'}}>
        {this.props.loading && (
          <div style={styles.loader}>
            <CircularProgress style={styles.loader} mode='indeterminate' size={0.5}/>
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
    ...globalStyles.rounded,
    ...globalStyles.windowBorder,
    position: 'relative',
    overflow: 'hidden',
    height: 364,
    minHeight: 364,
    maxHeight: 364,
    marginTop: -1, // let arrow not have a border below it
    flex: 1
  },
  arrow: {
    ...globalStyles.topMost,
    width: 0,
    height: 10,
    minHeight: 10,
    borderLeft: '7px solid transparent',
    borderRight: '7px solid transparent',
    borderBottom: `5px solid ${globalColors.grey5}`,
    alignSelf: 'center'
  },
  header: {
    ...globalStyles.flexBoxRow,
    backgroundColor: globalColors.grey5,
    color: globalColors.grey2,
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
    top: 0,
    right: 0,
    opacity: 0.8
  },
  footer: {
    ...globalStyles.flexBoxRow,
    backgroundColor: globalColors.grey5,
    justifyContent: 'space-between',
    padding: 10
  },
  personalTLDStyle: {
    fontSize: 15,
    lineHeight: '18px',
    color: globalColors.lightBlue
  },
  showAllBox: {
    color: globalColors.white,
    ...globalStyles.fontBold,
    fontSize: 8,
    backgroundColor: globalColors.grey3,
    minWidth: 16,
    minHeight: 11,
    borderRadius: 2,
    alignSelf: 'center',
    marginRight: 8
  },
  entryArrow: {
    ...globalStyles.clickable,
    color: globalColors.grey2,
    width: 25,
    fontSize: 13,
    height: 25,
    textAlign: 'center',
    position: 'absolute',
    right: 0,
    top: 5
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
