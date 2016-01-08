/* @flow */
/*eslint-disable react/prop-types */ // Since we're using flow types for props

import React, {Component} from '../base-react'
import resolveAssets from '../../../desktop/resolve-assets'

import {intersperseFn} from '../util/arrays'
import {parseFolderNameToUsers, canonicalizeUsernames, stripPublicTag} from '../util/kbfs'

import {globalStyles, globalColors} from '../styles/style-guide'
import {Text, Button, Divider} from '../common-adapters/index.desktop.js'

import {CircularProgress} from 'material-ui'

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

  return (
    <div style={styles.header}>
      <i className={`fa fa-folder`} style={{...styles.icons, fontSize: 17, marginRight: 10}} onClick={openKBFS}/>
      <i className={`fa fa-globe`} style={{...styles.icons, fontSize: 16}} onClick={showUser}/>
    </div>
  )
}

const OpeningMessage = props => {
  const message: string = props.message

  if (!message) {
    return null
  }

  const buttonInfo: ?{
    text: string,
    onClick: () => void
  } = props.buttonInfo

  return (
    <div style={styles.openingMessage}>
      <Text style={{textAlign: 'center', marginTop: 18, marginBottom: 11}} type='Body' reversed>{message}</Text>
      {buttonInfo && <Button style={{marginBottom: 22}} onClick={buttonInfo.onClick} label={buttonInfo.text}/>}
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

export default class Render extends Component {
  props: {
    username: ?string,
    openingMessage: ?string,
    openKBFS: () => void,
    openKBFSPublic: () => void,
    openKBFSPrivate: () => void,
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
    const {openKBFS, openKBFSPublic, openKBFSPrivate, showMain, showHelp, showUser, quit, openingButtonInfo, username} = this.props

    return (
      <div style={styles.container}>
        <div style={styles.arrow}/>
        <div style={styles.body}>
          <Header openKBFS={openKBFS} showUser={() => showUser(username)}/>
          {this.props.openingMessage && <OpeningMessage message={this.props.openingMessage} buttonInfo={openingButtonInfo}/>}
          {this.props.username && <FolderList loading={this.props.loading} username={this.props.username} openKBFSPublic={openKBFSPublic} openKBFSPrivate={openKBFSPrivate} folders={this.props.folders}/>}
          {!this.props.username && <div style={{flex: 1, backgroundColor: globalColors.white}}/>}
          <Footer debug={this.props.debug || false} showHelp={showHelp} quit={quit} showMain={showMain}/>
        </div>
      </div>
    )
  }
}

class FolderRow extends Component {
  props: {
    username: string,
    folder: FolderInfo
  };

  renderFolderText (text, color, key = null) {
    return <Text type='Body' key={key || text} style={{color}}>{text}</Text>
  }

  // Folder name is rendered a bit weird. If we only have our name it's the normal color
  // If we have our name and someone else, our name is toned down
  renderFolderName () {
    const {username, folder: {folderName, openFolder}} = this.props
    let users = canonicalizeUsernames(username, parseFolderNameToUsers(folderName))
    const folderText = users.map(u => this.renderFolderText(u, u === username ? globalColors.lightBlue : globalColors.blue))

    return (
      <div style={{...globalStyles.clickable, ...globalStyles.flexBoxRow, flexWrap: 'wrap', marginTop: 2}} onClick={openFolder}>
        {intersperseFn(i => this.renderFolderText(',', globalColors.lightBlue, i), folderText)}
      </div>
    )
  }

  render () {
    const {folder: {isPublic, isEmpty, openFolder}} = this.props

    return (
      <div style={{...globalStyles.flexBoxRow, alignItems: 'flex-start', paddingTop: 10, paddingBottom: 10}}>
        <div style={{...globalStyles.clickable, ...SVGFolderIcon(iconPath(isPublic, isEmpty)), marginRight: 6}} onClick={openFolder}/>
        {this.renderFolderName()}
      </div>
    )
  }
}

class CollapsableFolderList extends Component {
  props: {
    username: string,
    folders: Array<FolderInfo>,
    folderDisplayLimit: number,
    collapsed: boolean,
    onExpand: () => void
  };

  render () {
    const {collapsed, onExpand, username, folderDisplayLimit} = this.props
    const folderToElement = f => <FolderRow key={f.folderName} username={username} folder={f}/>

    let {folders} = this.props
    let truncatedCount = 0
    // Check if it's bigger by one because it's pointless to have a button
    // that says show all for just one more thing
    if (collapsed && folders.length > folderDisplayLimit + 1) {
      folders = folders.slice(0, folderDisplayLimit)
      truncatedCount = this.props.folders.length - folderDisplayLimit
    }

    return (
      <div style={{...globalStyles.flexBoxColumn}}>
        {intersperseFn(i => <Divider key={i} />, folders.map(folderToElement))}
        {truncatedCount > 0 && <Button primary onClick={onExpand} label={`Show all (+${truncatedCount})`} style={{alignSelf: 'center'}}/>}
      </div>
    )
  }
}

class FolderList extends Component {
  props: {
    loading: boolean,
    username: string,
    folders: Array<FolderInfo>,
    openKBFSPublic: () => void,
    openKBFSPrivate: () => void
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

    // Remove folders that are just our personal ones, we'll add those in later
    // For consistency. Since we aren't gauranteed we have favorited our own folders.
    const folders = this.props.folders.filter(f => stripPublicTag(f.folderName) !== username)

    const personalPrivateFolder: FolderInfo = {
      folderName: username,
      isPublic: false,
      isEmpty: true,
      openFolder: this.props.openKBFSPrivate
    }

    const personalPublicFolder: FolderInfo = {
      folderName: username,
      isPublic: true,
      isEmpty: true,
      openFolder: this.props.openKBFSPublic
    }

    const privateFolders = [personalPrivateFolder].concat(folders.filter(f => !f.isPublic))
    const publicFolders = [personalPublicFolder].concat(folders.filter(f => f.isPublic)).map(f => ({...f, folderName: stripPublicTag(f.folderName)}))

    return (
      <div style={styles.folderList}>
        {this.props.loading && <div style={styles.loader}>
          <CircularProgress style={styles.loader} mode='indeterminate' size={0.5}/>
        </div>}
        <div>
          <Text type='Body'>private/</Text>
          <CollapsableFolderList
            username={username}
            folders={privateFolders}
            folderDisplayLimit={5}
            collapsed={this.state.privateCollapsed}
            onExpand={() => { this.setState({privateCollapsed: false}) }}/>
        </div>

        <div>
          <Text type='Body' style={{marginTop: 20}}>public/</Text>
          <CollapsableFolderList
            username={username}
            folders={publicFolders}
            folderDisplayLimit={5}
            collapsed={this.state.publicCollapsed}
            onExpand={() => { this.setState({publicCollapsed: false}) }}/>
        </div>
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
    position: 'relative',
    overflow: 'hidden',
    height: 364,
    minHeight: 364,
    maxHeight: 364,
    flex: 1
  },
  arrow: {
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
    minHeight: 32,
    maxHeight: 32,
    padding: 10
  },
  icons: {
    ...globalStyles.clickable,
    color: globalColors.grey2
  },
  openingMessage: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColors.blue,
    alignItems: 'center'
  },
  folderList: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColors.white,
    position: 'relative',
    flex: 1,
    paddingTop: 17,
    paddingLeft: 18,
    paddingBottom: 9,
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
  }
}

const SVGFolderIcon = svgPath => ({
  height: 28,
  minWidth: 25,
  maxWidth: 25,
  backgroundImage: `url(${svgPath})`,
  backgroundRepeat: 'no-repeat'
})
