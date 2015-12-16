/* @flow */
/*eslint-disable react/prop-types */ // Since we're using flow types for props

import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'
import resolveAssets from '../../../desktop/resolve-assets'

import commonStyles, {colors} from '../styles/common'

const publicFolder = `file:///${resolveAssets('../react-native/react/images/folders/kb-folder-public-empty.svg')}`
const privateFolder = `file:///${resolveAssets('../react-native/react/images/folders/kb-folder-private-empty.svg')}`

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
    debug?: boolean
  };

  render (): ReactElement {
    const {openKBFS, openKBFSPublic, openKBFSPrivate, showMain, showHelp, quit, openingButtonInfo} = this.props

    return (
      <div style={{backgroundColor: colors.white, width: 320, ...commonStyles.fontRegular}}>
        <Header openKBFS={openKBFS} showHelp={showHelp}/>
        {this.props.openingMessage && <OpeningMessage message={this.props.openingMessage} buttonInfo={openingButtonInfo} showHelp={showHelp}/>}
        {this.props.username && <FolderList username={this.props.username} openKBFSPublic={openKBFSPublic} openKBFSPrivate={openKBFSPrivate}/>}
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

class FolderList extends Component {
  props: {
    username: string,
    openKBFSPublic: () => void,
    openKBFSPrivate: () => void
  };

  render () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', backgroundColor: colors.trueWhite, paddingTop: 17, paddingLeft: 18, paddingBottom: 9}}>
        <div>
          <div style={{...rootFolderStyle}}>private/</div>
          <div style={{height: 40, display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
            <div style={{display: 'flex', flexDirection: 'row'}}>
              <div style={{...commonStyles.clickable, ...SVGFolderIcon(privateFolder), marginRight: 6}} onClick={this.props.openKBFSPrivate}/>
              <div style={{...commonStyles.clickable, ...personalTLDStyle}} onClick={this.props.openKBFSPrivate}>{this.props.username}</div>
            </div>
          </div>
        </div>

        <div>
          <div style={{...rootFolderStyle}}>public/</div>
          <div style={{height: 40, display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
            <div style={{display: 'flex', flexDirection: 'row'}}>
              <div style={{...commonStyles.clickable, ...SVGFolderIcon(publicFolder), marginRight: 6}} onClick={this.props.openKBFSPublic}/>
              <div style={{...personalTLDStyle, ...commonStyles.clickable}} onClick={this.props.openKBFSPublic}>{this.props.username}</div>
            </div>
          </div>
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
  color: colors.black
}

const personalTLDStyle = {
  fontSize: 15,
  lineHeight: '18px',
  color: colors.lightBlue
}

const SVGFolderIcon = svgPath => ({
  height: 25,
  width: 25,
  backgroundPositionY: -3,
  backgroundImage: `url(${svgPath})`
})
