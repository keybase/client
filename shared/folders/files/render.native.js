// @flow
import File from './file/render'
import React, {Component} from 'react'
import {Box, Button, Text, BackButton, Avatar, Icon, Usernames, NativeScrollView, ListItem} from '../../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins, statusBarHeight} from '../../styles'
import {intersperseFn} from '../../util/arrays'

import type {IconType} from '../../common-adapters/icon'
import type {FileSection} from '../../constants/folders'
import type {Props} from './render'

const Divider = ({theme, backgroundColor, color}) => (
  <Box style={{...globalStyles.flexBoxRow, height: 1, backgroundColor}}>
    <Box style={{marginLeft: 48 + 8, backgroundColor: color, flex: 1}} />
  </Box>
)

const ParticipantUnlock = ({waitingForParticipantUnlock, isPrivate, backgroundMode, theme}) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Text type='BodySemibold' style={styleWarningBanner}>This folder is waiting for either participant to turn on a device.</Text>
      <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Box style={{marginTop: globalMargins.small, paddingLeft: globalMargins.small, paddingRight: globalMargins.small}}>
          {intersperseFn(i => <Divider key={i} color={isPrivate ? globalColors.black_10 : globalColors.black_05} backgroundColor={isPrivate ? globalColors.darkBlue3 : globalColors.lightGrey} />, waitingForParticipantUnlock.map(p => (
            <ListItem
              key={p.name}
              type='Large' action={<Box />} icon={<Avatar size={40} username={p.name} />}
              body={<Box style={{...globalStyles.flexBoxColumn}}>
                <Text type='Body' backgroundMode={backgroundMode}>{p.name}</Text>
                <Text type='BodySmall' backgroundMode={backgroundMode}>{p.devices}</Text>
              </Box>} />
          )))}
        </Box>
      </NativeScrollView>
    </Box>
  )
}
const deviceIcon: (isPrivate: boolean, type: string) => IconType = (isPrivate, type) => ({
  'private': {
    'backup': 'icon-paper-key-dark-blue-32',
    'desktop': 'icon-computer-dark-blue-32',
    'mobile': 'icon-phone-dark-blue-32',
  },
  'public': {
    'backup': 'icon-paper-key-32',
    'desktop': 'icon-computer-32',
    'mobile': 'icon-phone-32',
  },
}[isPrivate ? 'private' : 'public'][type])

const YouCanUnlock = ({youCanUnlock, isPrivate, backgroundMode, onClickPaperkey, theme}) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Text type='BodySemibold' style={styleWarningBanner}>Until you take one of the steps below, you're at risk of losing data forever.</Text>
      <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1, marginTop: globalMargins.small, paddingLeft: globalMargins.small, paddingRight: globalMargins.small}}>
        {intersperseFn(i => <Divider key={i} theme={theme} />,
        youCanUnlock.map(device => (
          <ListItem
            key={device.name}
            type='Large' action={device.type === 'backup'
              ? <Button label='Enter paper key' onClick={() => onClickPaperkey(device)} type='Secondary' backgroundMode={backgroundMode} />
              : <Box />}
            icon={<Icon type={deviceIcon(isPrivate, device.type)} />}
            body={<Box style={{...globalStyles.flexBoxColumn}}>
              <Text type='Body' backgroundMode={backgroundMode}>{device.name}</Text>
              {device.type !== 'backup' && <Text type='BodySmall' backgroundMode={backgroundMode}>Open the Keybase app</Text>}
            </Box>} />
        )))}
      </NativeScrollView>
    </Box>
  )
}
class FilesRender extends Component<void, Props, void> {
  _renderSection (section: FileSection) {
    return (
      <Box key={section.name} style={{...globalStyles.flexBoxColumn, backgroundColor: backgroundColorThemed[this.props.theme]}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 32}}>
          <Box key={section.name} style={{...globalStyles.flexBoxRow, marginLeft: globalMargins.tiny}}>
            {section.modifiedMarker && <Icon type='iconfont-thunderbolt' style={{marginRight: 6, alignSelf: 'center', fontSize: 10, ...styleSectionTextThemed[this.props.theme]}} />}
            <Text type='BodySmallSemibold' style={{...styleSectionTextThemed[this.props.theme]}}>{section.name}</Text>
          </Box>
        </Box>
        {intersperseFn(i => <Box key={i} style={{height: 0.5, backgroundColor: globalColors.black_10}} />,
                       section.files.map(f => <File key={f.name} {...f} />))}
      </Box>
    )
  }

  // TODO render checkerboard pattern for private mode
  _renderHeader () {
    const menuColor = styleMenuColorThemed(this.props.theme, this.props.visiblePopupMenu)
    const backButtonColor = backButtonColorThemed[this.props.theme]

    const contents = (
      <Box style={{...globalStyles.flexBoxRow, justifyContent: 'space-between', ...styleHeaderThemed[this.props.theme], height: 48}}>
        <BackButton title={null} onClick={this.props.onBack} style={{marginLeft: globalMargins.small}} iconStyle={{color: backButtonColor}} textStyle={{color: backButtonColor}} />
        <Icon
          underlayColor={'transparent'}
          style={{...styleMenu, color: menuColor, marginRight: globalMargins.small}}
          type='iconfont-hamburger'
          onClick={this.props.onTogglePopupMenu} />
      </Box>
    )

    return contents
  }

  _renderContents (isPrivate: boolean, ignored: boolean, allowIgnore: boolean) {
    const backgroundMode = isPrivate ? 'Terminal' : 'Normal'

    if (this.props.youCanUnlock.length) {
      return <YouCanUnlock
        youCanUnlock={this.props.youCanUnlock}
        isPrivate={isPrivate}
        backgroundMode={backgroundMode}
        theme={this.props.theme}
        onClickPaperkey={this.props.onClickPaperkey} />
    }

    if (this.props.waitingForParticipantUnlock.length) {
      return <ParticipantUnlock
        waitingForParticipantUnlock={this.props.waitingForParticipantUnlock}
        isPrivate={isPrivate}
        theme={this.props.theme}
        backgroundMode={backgroundMode} />
    }

    if (!this.props.recentFilesEnabled) {
      return (
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          {ignored
          ? allowIgnore && <Button type='Secondary' onClick={this.props.unIgnoreCurrentFolder} label='Unignore folder' />
          : allowIgnore && <Button backgroundMode={isPrivate ? 'Terminal' : 'Normal'} type='Secondary' onClick={this.props.ignoreCurrentFolder} label='Ignore folder' />}
        </Box>
      )
    } else {
      return <NativeScrollView>{this.props.recentFilesSection.map(s => this._renderSection(s))}</NativeScrollView>
    }
  }

  render () {
    const isPrivate = this.props.theme === 'private'
    const tlfTextStyle = styleTLFTextThemed[this.props.theme]

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative', backgroundColor: backgroundColorThemed[this.props.theme], paddingTop: statusBarHeight}}>
        {this._renderHeader()}
        <Box style={{...styleTLFHeader, ...styleTLFHeaderThemed[this.props.theme]}}>
          <Box style={{...globalStyles.flexBoxRow, position: 'relative', justifyContent: 'center', alignItems: 'flex-start', marginTop: -1 * globalMargins.small}}>
            {this.props.users.map(u => <Box key={u.username} style={{height: 32, width: 28}}><Avatar username={u.username} size={32} /></Box>)}
          </Box>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-end', justifyContent: 'center', marginTop: 3, marginBottom: 12, flex: 1}}>
            <Text type='BodySemibold' style={tlfTextStyle}>{isPrivate ? 'private/' : 'public/'}</Text>
            <Usernames users={this.props.users} type='Header' style={tlfTextStyle} />
          </Box>
        </Box>
        {this._renderContents(isPrivate, this.props.ignored, this.props.allowIgnore)}
      </Box>
    )
  }
}

const styleHeaderThemed = {
  'private': {
    backgroundColor: globalColors.darkBlue3,
  },

  'public': {
    backgroundColor: globalColors.yellowGreen,
  },
}

const styleTLFHeader = {
  ...globalStyles.flexBoxColumn,
  minHeight: 48,
}

const styleTLFHeaderThemed = {
  'private': {
    backgroundColor: globalColors.darkBlue,
  },

  'public': {
    backgroundColor: globalColors.white,
  },
}

const styleTLFTextThemed = {
  'private': {
    color: globalColors.white,
  },

  'public': {
    color: globalColors.yellowGreen,
  },
}

const styleSectionTextThemed = {
  'public': {
    color: globalColors.black_40,
  },
  'private': {
    color: globalColors.blue3_40,
  },
}

const backgroundColorThemed = {
  'public': globalColors.lightGrey,
  'private': globalColors.darkBlue3,
}

const styleMenu = {
  ...globalStyles.clickable,
  alignSelf: 'center',
}

const backButtonColorThemed = {
  'private': globalColors.white,
  'public': globalColors.white,
}

const styleWarningBanner = {
  backgroundColor: globalColors.red,
  color: globalColors.white,
  paddingTop: 13,
  paddingBottom: 13,
  paddingLeft: globalMargins.xlarge,
  paddingRight: globalMargins.xlarge,
  textAlign: 'center',
}

function styleMenuColorThemed (theme, showingMenu): string {
  return theme === 'public'
    ? (showingMenu ? globalColors.black_40 : globalColors.white)
    : (showingMenu ? globalColors.blue3 : globalColors.white)
}

export default FilesRender
