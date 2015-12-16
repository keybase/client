/* @flow */
/*eslint-disable react/prop-types */ // Since we're using flow types for props

import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'
import resolveAssets from '../../../desktop/resolve-assets'

import commonStyles from '../styles/common'

const publicFolder = `file:///${resolveAssets('../react-native/react/images/folders/fa-folder-public-empty.svg')}`
const privateFolder = `file:///${resolveAssets('../react-native/react/images/folders/fa-folder-private-empty.svg')}`

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
      <div style={{backgroundColor: '#f6f6f4', width: 320}}>
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
        <i className={`fa fa-folder`} style={{...Clickable, color: '#777777', fontSize: 16, marginRight: '10px'}} onClick={this.props.openKBFS}/>
        <i className={`fa fa-globe`} style={{...Clickable, color: '#777777'}} onClick={this.props.showHelp}/>
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
      <div style={{backgroundColor: '#00bff0', display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
        <div style={{textAlign: 'center', color: '#ffffff', marginTop: 18, marginBottom: 11, marginRight: 32, marginLeft: 32}}>{this.props.message}</div>
        <div>
          {buttonInfo && <FlatButton style={{...commonStyles.primaryButton, ...NotoSans, fontSize: 17, marginBottom: 22}} onClick={buttonInfo.onClick} label={buttonInfo.text}/>}
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
      <div style={{display: 'flex', flexDirection: 'column', backgroundColor: '#ffffff', paddingTop: 17, paddingLeft: 18, paddingBottom: 9}}>
        <div>
          <div style={{...NotoSans, ...RootFolderStyle}}>private/</div>
          <div style={{height: 40, display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
            <div style={{display: 'flex', flexDirection: 'row'}}>
              <div style={{...Clickable, ...SVGFolderIcon(privateFolder), marginRight: 6}} onClick={this.props.openKBFSPrivate}/>
              <div style={{...NotoSans, ...PersonalTLDStyle, ...Clickable}} onClick={this.props.openKBFSPrivate}>{this.props.username}</div>
            </div>
          </div>
        </div>

        <div>
          <div style={{...NotoSans, ...RootFolderStyle}}>public/</div>
          <div style={{height: 40, display: 'flex', flexDirection: 'row', alignItems: 'center'}}>
            <div style={{display: 'flex', flexDirection: 'row'}}>
              <div style={{...Clickable, ...SVGFolderIcon(publicFolder), marginRight: 6}} onClick={this.props.openKBFSPublic}/>
              <div style={{...NotoSans, ...PersonalTLDStyle, ...Clickable}} onClick={this.props.openKBFSPublic}>{this.props.username}</div>
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
        <div style={{...Clickable, ...TransparentBlack, ...NotoSans, fontSize: 13, lineHeight: '17px'}} onClick={this.props.showHelp}>Help</div>
        {this.props.debug && <div style={{...Clickable, ...TransparentBlack, ...NotoSans, fontSize: 13, lineHeight: '17px'}} onClick={this.props.showMain}>Debug</div>}
        <div style={{...Clickable, ...TransparentBlack, ...NotoSans, fontSize: 13, lineHeight: '17px'}} onClick={this.props.quit}>Quit</div>
      </div>
    )
  }
}

const Clickable = {
  cursor: 'pointer'
}

const NotoSans = {
  fontFamily: 'Noto Sans'
}

const TransparentBlack = {
  color: '#333333',
  opacity: 0.6
}

const RootFolderStyle = {
  fontSize: 15,
  lineHeight: '17px',
  color: '#333333'
}

const PersonalTLDStyle = {
  fontSize: 15,
  lineHeight: '18px',
  color: '#00bff0'
}

const SVGFolderIcon = (svgPath) => ({
  height: 25,
  width: 25,
  backgroundPositionY: -6,
  backgroundImage: `url(${svgPath})`
})
