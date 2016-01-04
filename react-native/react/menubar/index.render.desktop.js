/* @flow */
/*eslint-disable react/prop-types */ // Since we're using flow types for props

import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'
import resolveAssets from '../../../desktop/resolve-assets'

import {intersperseFn} from '../util/arrays'
import {parseFolderNameToUsers, canonicalizeUsernames, stripPublicTag} from '../util/kbfs'

import commonStyles, {colors} from '../styles/common'

// This is the only data that the renderer cares about for a folder
import type {FolderInfo} from './index.render'

const folderIcon = {
  public: {
    empty: `file:///${resolveAssets('../react-native/react/images/folders/kb-folder-public-empty.svg')}`,
    full: `file:///${resolveAssets('../react-native/react/images/folders/kb-folder-public-full.svg')}`
  },
  private: {
    empty: `file:///${resolveAssets('../react-native/react/images/folders/kb-folder-private-empty.svg')}`,
    full: `file:///${resolveAssets('../react-native/react/images/folders/kb-folder-private-full.svg')}`
  }
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
    quit: () => void,
    openingButtonInfo: {
      text: string,
      onClick: () => void
    },
    folders: Array<FolderInfo>,
    debug?: boolean
  };

  render (): ReactElement {
    const {openKBFS, openKBFSPublic, openKBFSPrivate, showMain, showHelp, quit, openingButtonInfo} = this.props

    return (
      <div style={{backgroundColor: colors.white, ...commonStyles.fontRegular, display: 'flex', flexDirection: 'column', height: '100%'}}>
        <Header openKBFS={openKBFS} showHelp={showHelp}/>
        {this.props.openingMessage && <OpeningMessage message={this.props.openingMessage} buttonInfo={openingButtonInfo} showHelp={showHelp}/>}
        {this.props.username && <FolderList username={this.props.username} openKBFSPublic={openKBFSPublic} openKBFSPrivate={openKBFSPrivate} folders={this.props.folders}/>}
        <Footer debug={this.props.debug || false} showHelp={showHelp} quit={quit} showMain={showMain}/>
      </div>
    )
  }
}

class Header extends Component {
  props: {
    openKBFS: () => void,
    showHelp: () => void
  };

  render () {
    return (
      <div style={{display: 'flex', flexDirection: 'row', paddingTop: 11, paddingLeft: 11, paddingBottom: 8}}>
        <i className={`fa fa-folder`} style={{...commonStyles.clickable, color: colors.warmGrey, fontSize: 16, marginRight: 10}} onClick={this.props.openKBFS}/>
        <i className={`fa fa-globe`} style={{...commonStyles.clickable, color: colors.warmGrey}} onClick={this.props.showHelp}/>
      </div>
    )
  }
}

class OpeningMessage extends Component {
  props: {
    message: string,
    buttonInfo: ?{
      text: string,
      onClick: () => void
    }
  };

  render () {
    const {buttonInfo} = this.props
    return (
      <div style={{backgroundColor: colors.lightBlue, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{textAlign: 'center', color: colors.trueWhite, marginTop: 18, marginBottom: 11, marginRight: 32, marginLeft: 32}}>{this.props.message}</div>
        <div>
          {buttonInfo && <FlatButton style={{...commonStyles.primaryButton, ...commonStyles.fontRegular, fontSize: 17, marginBottom: 22}} onClick={buttonInfo.onClick} label={buttonInfo.text}/>}
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
    return <div key={key || text} style={{...personalTLDStyle, color}}>{text}</div>
  }

  // Folder name is rendered a bit weird. If we only have our name it's the normal color
  // If we have our name and someone else, our name is toned down
  renderFolderName () {
    const {username, folder: {folderName, openFolder}} = this.props
    let folderText

    if (username === folderName) {
      folderText = [this.renderFolderText(username, colors.lightBlue)]
    } else {
      let users = canonicalizeUsernames(username, parseFolderNameToUsers(folderName))

      folderText = users.map(u => {
        if (u === username) {
          return this.renderFolderText(u, colors.lightTeal)
        }
        return this.renderFolderText(u, colors.lightBlue)
      })
    }

    return (
      <div style={{...commonStyles.clickable, display: 'flex', flexDirection: 'row'}} onClick={openFolder}>
        {intersperseFn(i => this.renderFolderText(',', colors.lightTeal, i), folderText)}
      </div>
    )
  }

  render () {
    const {folder: {isPublic, isEmpty, openFolder}} = this.props
    const iconPath = folderIcon[isPublic ? 'public' : 'private'][isEmpty ? 'empty' : 'full']
    return (
      <div style={{display: 'flex', flexDirection: 'row', height: 40, alignItems: 'center'}}>
        <div style={{...commonStyles.clickable, ...SVGFolderIcon(iconPath), marginRight: 6}} onClick={openFolder}/>
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

  separator (key) {
    return <div key={key} style={{...commonStyles.separator, backgroundColor: colors.transparentGrey}}/>
  }

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
      <div>
        {intersperseFn(i => this.separator(i), folders.map(folderToElement))}
        {truncatedCount > 0 &&
          <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'center', marginTop: 10}}>
            <FlatButton
              style={{...commonStyles.primaryButton, ...commonStyles.fontRegular, fontSize: 17, width: null}}
              onClick={onExpand} label={`Show all (+${truncatedCount})`}/>
          </div>}
      </div>
    )
  }
}

class FolderList extends Component {
  props: {
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
      <div style={{display: 'flex', flexDirection: 'column', flexGrow: 2, backgroundColor: colors.trueWhite, paddingTop: 17, paddingLeft: 18, paddingBottom: 9, overflowY: 'scroll', overflowX: 'hidden'}}>
        <div>
          <div style={{...rootFolderStyle}}>private/</div>
          <CollapsableFolderList
            username={username}
            folders={privateFolders}
            folderDisplayLimit={5}
            collapsed={this.state.privateCollapsed}
            onExpand={() => { this.setState({privateCollapsed: false}) }}/>
        </div>

        <div>
          <div style={{...rootFolderStyle, marginTop: 14}}>public/</div>
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

class Footer extends Component {
  props: {
    debug: boolean,
    showHelp: () => void,
    showMain: () => void,
    quit: () => void
  };

  render () {
    return (
      <div style={{display: 'flex', flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 11, paddingRight: 11, paddingTop: 8, paddingBottom: 8}}>
        <div style={{...commonStyles.clickable, ...commonStyles.transparentBlack, fontSize: 13, lineHeight: '17px'}} onClick={this.props.showHelp}>Help</div>
        {this.props.debug && <div style={{...commonStyles.clickable, ...commonStyles.transparentBlack, fontSize: 13, lineHeight: '17px'}} onClick={this.props.showMain}>Debug</div>}
        <div style={{...commonStyles.clickable, ...commonStyles.transparentBlack, fontSize: 13, lineHeight: '17px'}} onClick={this.props.quit}>Quit</div>
      </div>
    )
  }
}

const rootFolderStyle = {
  fontSize: 15,
  lineHeight: '17px',
  color: colors.black,
  marginBottom: 12
}

const personalTLDStyle = {
  fontSize: 15,
  lineHeight: '18px',
  color: colors.lightBlue
}

const SVGFolderIcon = svgPath => ({
  height: 28,
  width: 25,
  marginTop: 2,
  backgroundImage: `url(${svgPath})`,
  backgroundRepeat: 'no-repeat'
})
