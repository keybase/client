// @flow
import React, {Component} from 'react'
import {ScrollView} from 'react-native'
import {Box, Text, BackButton, Avatar, Icon, Usernames} from '../../common-adapters'
import File from './file/render'
import {globalStyles, globalColors} from '../../styles/style-guide'
import {intersperseFn} from '../../util/arrays'
import type {Props, FileSection} from './render'

export default class Render extends Component<void, Props, void> {
  _renderSection (section: FileSection) {
    return (
      <Box key={section.name} style={{...globalStyles.flexBoxColumn, backgroundColor: backgroundColorThemed[this.props.theme]}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 32}}>
          <Box key={section.name} style={{...globalStyles.flexBoxRow, marginLeft: 8}}>
            {section.modifiedMarker && <Icon type='fa-kb-iconfont-thunderbolt' style={{fontSize: 13, marginRight: 6, ...styleSectionTextThemed[this.props.theme]}} />}
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
        <BackButton title={null} onClick={this.props.onBack} style={{marginLeft: 16}} iconStyle={{color: backButtonColor}} textStyle={{color: backButtonColor}} />
        <Icon
          underlayColor={'transparent'}
          style={{...styleMenu, color: menuColor, marginRight: 16}}
          type='fa-kb-iconfont-hamburger'
          onClick={this.props.onTogglePopupMenu} />
      </Box>
    )

    return contents
  }

  _renderContents (isPrivate: boolean) {
    if (!this.props.recentFilesEnabled) {
      return (
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center', padding: 8}}>
          <Text type='BodySmall' backgroundMode={isPrivate ? 'Terminal' : 'Normal'}>File History has not been implemented yet.</Text>
        </Box>
      )
    } else {
      return <ScrollView>{this.props.recentFilesSection.map(s => this._renderSection(s))}</ScrollView>
    }
  }

  render () {
    const isPrivate = this.props.theme === 'private'
    const tlfTextStyle = styleTLFTextThemed[this.props.theme]

    return (
      <Box style={{...globalStyles.flexBoxColumn, flex: 1, position: 'relative', backgroundColor: backgroundColorThemed[this.props.theme]}}>
        {this._renderHeader()}
        <Box style={{...globalStyles.flexBoxColumn, ...styleTLFHeader, ...styleTLFHeaderThemed[this.props.theme]}}>
          <Box style={{...globalStyles.flexBoxRow, height: 0, justifyContent: 'center', position: 'relative', bottom: 16}}>
            {this.props.users.map(u => <Box key={u.username} style={{height: 32, width: 28}}><Avatar username={u.username} size={32} /></Box>)}
          </Box>
          <Box style={{...globalStyles.flexBoxRow, alignItems: 'flex-end', justifyContent: 'center', marginTop: 20, marginBottom: 20}}>
            <Text type='BodySmallSemibold' style={tlfTextStyle}>{isPrivate ? 'private/' : 'public/'}</Text>
            <Usernames users={this.props.users} type='BodySemibold' style={tlfTextStyle} />
          </Box>
        </Box>
        {this._renderContents(isPrivate)}
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
  height: 64,
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
    color: globalColors.black_60,
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
  fontSize: 12,
}

const backButtonColorThemed = {
  'private': globalColors.white,
  'public': globalColors.white,
}

function styleMenuColorThemed (theme, showingMenu): string {
  return theme === 'public'
    ? (showingMenu ? globalColors.black_40 : globalColors.white)
    : (showingMenu ? globalColors.blue3 : globalColors.white)
}
