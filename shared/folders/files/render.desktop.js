// @flow
import React, {Component} from 'react'
import {Box, Text, BackButton, Avatar, PopupMenu, Icon, Usernames, ListItem, Button} from '../../common-adapters'
import File from './file/render'
import {globalStyles, globalColors} from '../../styles/style-guide'
import {resolveImageAsURL} from '../../../desktop/resolve-root'
import {intersperseFn} from '../../util/arrays'
import type {Props} from './render'

const Section = ({section, theme}) => (
  <Box style={{...globalStyles.flexBoxColumn, backgroundColor: backgroundColorThemed[theme]}}>
    <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 32}}>
      <Box key={section.name} style={{display: 'inline', marginLeft: 8}}>
        {section.modifiedMarker && <Icon type='fa-kb-iconfont-thunderbolt' style={{fontSize: 12, marginRight: 6, ...styleSectionTextThemed[theme]}} />}
        <Text type='BodySmallSemibold' style={{...styleSectionTextThemed[theme]}}>{section.name}</Text>
      </Box>
    </Box>
    {intersperseFn(i => <Box key={i} style={{height: 1, backgroundColor: globalColors.black_10}} />,
      section.files.map(f => <File key={f.name} {...f} />))}
  </Box>
)

const ParticipantUnlock = ({waitingForParticipantUnlock, isPrivate, backgroundMode}) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Text type='BodySmallSemibold' style={styleWarningBanner}>This folder is waiting for either participant to turn on a device.</Text>
      <Box style={{...globalStyles.flexBoxColumn, marginTop: 38, paddingLeft: 64, paddingRight: 64}}>
        {intersperseFn(i => <Box key={i} style={{height: 1, backgroundColor: isPrivate ? globalColors.white_40 : globalColors.black_10}} />,
        waitingForParticipantUnlock.map(p => (
          <ListItem
            key={p.name}
            type='Large' action={<Box />} icon={<Avatar size={48} username={p.name} />}
            body={<Box style={{...globalStyles.flexBoxColumn}}>
              <Text type='Body' backgroundMode={backgroundMode} onClick={p.onClick}>{p.name}</Text>
              <Text type='BodySmall' backgroundMode={backgroundMode}>{p.devices}</Text>
            </Box>} />
        )))}
      </Box>
    </Box>
  )
}

const YouCanUnlock = ({youCanUnlock, isPrivate, backgroundMode}) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Text type='BodySmallSemibold' style={styleWarningBanner}>Until you take one of the steps below, you're at risk of losing data forever.</Text>
      <Box style={{...globalStyles.flexBoxColumn, marginTop: 38, paddingLeft: 64, paddingRight: 64}}>
        {intersperseFn(i => <Box key={i} style={{height: 1, backgroundColor: isPrivate ? globalColors.white_40 : globalColors.black_10}} />,
        youCanUnlock.map(device => (
          <ListItem
            key={device.name}
            type='Large' action={device.onClickPaperkey
              ? <Button label='Enter paper key' onClick={device.onClickPaperkey} type='Secondary' backgroundMode={backgroundMode} />
              : <Box />}
            icon={<Icon type={device.icon} />}
            body={<Box style={{...globalStyles.flexBoxColumn}}>
              <Text type='Body' backgroundMode={backgroundMode}>{device.name}</Text>
              {!device.onClickPaperkey && <Text type='BodySmall' backgroundMode={backgroundMode}>Open the Keybase app</Text>}
            </Box>} />
        )))}
      </Box>
    </Box>
  )
}

export default class Render extends Component<void, Props, void> {

  _renderContents (isPrivate: boolean) {
    const backgroundMode = isPrivate ? 'Terminal' : 'Normal'

    if (!this.props.recentFilesEnabled) {
      return (
        <Box style={{...styleRecentFilesNotEnabled}}>
          <Button type='Secondary' onClick={this.props.ignoreCurrentFolder} label='Ignore folder' />
          <Button type='Primary' onClick={this.props.openCurrentFolder} label='Open folder' />
        </Box>
      )
    }

    if (this.props.youCanUnlock.length) {
      return <YouCanUnlock youCanUnlock={this.props.youCanUnlock} isPrivate={isPrivate} backgroundMode={backgroundMode} />
    }

    if (this.props.waitingForParticipantUnlock.length) {
      return <ParticipantUnlock waitingForParticipantUnlock={this.props.waitingForParticipantUnlock} isPrivate={isPrivate} backgroundMode={backgroundMode} />
    }

    if (this.props.recentFilesSection.length) {
      return (
        <Box style={{...globalStyles.flexBoxColumn}}>
          {this.props.recentFilesSection.map(s => <Section key={s.name} section={s} theme={this.props.theme} />)}
        </Box>
      )
    } else {
      return (
        <Box style={styleNoFiles}>
          <Text type='BodySmall' backgroundMode={backgroundMode}>This folder is empty.</Text>
          <Text type='BodySmallLink' onClick={this.props.openCurrentFolder} backgroundMode={backgroundMode}>Open folder</Text>
        </Box>
      )
    }
  }

  render () {
    const isPrivate = this.props.theme === 'private'
    const menuColor = styleMenuColorThemed(this.props.theme, this.props.visiblePopupMenu)
    const backButtonColor = backButtonColorThemed[this.props.theme]
    const tlfTextStyle = styleTLFTextThemed[this.props.theme]

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative', backgroundColor: backgroundColorThemed[this.props.theme]}}>
        <Box style={{...globalStyles.flexBoxRow, ...styleHeaderThemed[this.props.theme], height: 48}}>
          <BackButton onClick={this.props.onBack} style={{marginLeft: 16}}
            iconStyle={{color: backButtonColor}} textStyle={{color: backButtonColor}} />
          <Icon
            style={{...styleMenu, color: menuColor, hoverColor: menuColor, marginRight: 16, position: 'relative', top: 14}}
            type='fa-kb-iconfont-hamburger'
            onClick={this.props.onTogglePopupMenu} />
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, ...styleTLFHeader, ...styleTLFHeaderThemed[this.props.theme]}}>
          <Box style={{...globalStyles.flexBoxRow, height: 0, justifyContent: 'center', position: 'relative', bottom: 16}}>
            {this.props.users.map(u => <Box key={u.username} style={{height: 32, width: 28}}><Avatar username={u.username} size={32} /></Box>)}
          </Box>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'baseline', marginBottom: 'auto', marginTop: 'auto'}}>
            <Text type='BodySmallSemibold' style={tlfTextStyle}>{isPrivate ? 'private/' : 'public/'}</Text>
            <Usernames users={this.props.users} type='BodySemibold' style={tlfTextStyle} />
          </Box>
        </Box>
        <PopupMenu style={{marginLeft: 'auto', marginRight: 8, marginTop: 36, width: 320}} items={this.props.popupMenuItems} visible={this.props.visiblePopupMenu} onHidden={this.props.onTogglePopupMenu} />
        {this._renderContents(isPrivate)}
      </Box>
    )
  }
}

const styleHeaderThemed = {
  'private': {
    backgroundColor: globalColors.darkBlue3,
    backgroundImage: `url(${resolveImageAsURL('icons', 'damier-pattern-good-open.png')})`,
    backgroundRepeat: 'repeat'
  },

  'public': {
    backgroundColor: globalColors.yellowGreen
  }
}

const styleTLFHeader = {
  height: 64,
  alignItems: 'center'
}

const styleTLFHeaderThemed = {
  'private': {
    backgroundColor: globalColors.darkBlue
  },

  'public': {
    backgroundColor: globalColors.white
  }
}

const styleTLFTextThemed = {
  'private': {
    color: globalColors.white
  },

  'public': {
    color: globalColors.yellowGreen
  }
}

const styleSectionTextThemed = {
  'public': {
    color: globalColors.black_60
  },
  'private': {
    color: globalColors.blue3_40
  }
}

const backgroundColorThemed = {
  'public': globalColors.lightGrey,
  'private': globalColors.darkBlue3
}

const styleMenu = {
  ...globalStyles.clickable,
  marginLeft: 'auto',
  fontSize: 24
}

const backButtonColorThemed = {
  'private': globalColors.white,
  'public': globalColors.white
}

const styleRecentFilesNotEnabled = {
  ...globalStyles.flexBoxRow,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 64
}

const styleNoFiles = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: 64
}

const styleWarningBanner = {
  backgroundColor: globalColors.red,
  color: globalColors.white,
  paddingTop: 13,
  paddingBottom: 13,
  paddingLeft: 64,
  paddingRight: 64,
  textAlign: 'center'
}

function styleMenuColorThemed (theme, showingMenu): string {
  return theme === 'public'
    ? (showingMenu ? globalColors.black_40 : globalColors.white)
    : (showingMenu ? globalColors.blue3 : globalColors.white)
}
