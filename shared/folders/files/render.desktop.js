// @flow
import React, {Component} from 'react'
import {Box, Text, BackButton, Avatar, PopupMenu, Icon} from '../../common-adapters'
import File from './file/render'
import {globalStyles, globalColors} from '../../styles/style-guide'
import {resolveImageAsURL} from '../../../desktop/resolve-root'
import {intersperseFn} from '../../util/arrays'
import type {Props, FileSection} from './render'

export default class Render extends Component<void, Props, void> {
  _renderSection (section: FileSection) {
    return (
      <Box key={section.name} style={{...globalStyles.flexBoxColumn, backgroundColor: backgroundColorThemed[this.props.theme]}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 32}}>
          <Box key={section.name} style={{display: 'inline', marginLeft: 8}}>
            {section.modifiedMarker && <Icon type='thunderbolt' style={{height: 12, alignSelf: 'center', marginRight: 6, ...styleSectionTextThemed[this.props.theme]}} />}
            <Text type='BodySmallSemibold' style={{...styleSectionTextThemed[this.props.theme]}}>{section.name}</Text>
          </Box>
        </Box>
        {intersperseFn(i => <Box key={i} style={{height: 1, backgroundColor: globalColors.black_10}} />,
                       section.files.map(f => <File key={f.name} {...f} />))}
      </Box>
    )
  }

  render () {
    const isPrivate = this.props.theme === 'private'
    const menuColor = styleMenuColorThemed(this.props.theme, this.props.visiblePopupMenu)
    const backButtonColor = backButtonColorThemed[this.props.theme]
    const tlfTextStyle = styleTLFTextThemed[this.props.theme]

    return (
      <Box style={{...globalStyles.flexBoxColumn, position: 'relative', backgroundColor: backgroundColorThemed[this.props.theme]}}>
        <Box style={{...globalStyles.flexBoxRow, ...styleHeaderThemed[this.props.theme], height: 48}}>
          <BackButton onClick={this.props.onBack} style={{marginLeft: 16}} iconStyle={{color: backButtonColor}} textStyle={{color: backButtonColor}} />
          <Icon
            style={{...styleMenu, color: menuColor, hoverColor: menuColor, marginRight: 16, position: 'relative', top: 18}}
            type='fa-custom-icon-hamburger'
            onClick={this.props.onTogglePopupMenu} />
        </Box>
        <Box style={{...globalStyles.flexBoxColumn, ...styleTLFHeader, ...styleTLFHeaderThemed[this.props.theme]}}>
          <Box style={{...globalStyles.flexBoxRow, height: 0, justifyContent: 'center', position: 'relative', bottom: 16}}>
            {this.props.users.map(u => <Box key={u} style={{height: 32, width: 28}}><Avatar username={u} size={32} /></Box>)}
          </Box>
          <Box style={{display: 'inline', marginBottom: 'auto', marginTop: 'auto'}}>
            <Text type='BodySmallSemibold' style={tlfTextStyle}>{isPrivate ? 'private/' : 'public/'}</Text>
            {intersperseFn(i => (<Text key={i} style={tlfTextStyle} type='BodySemibold'>,</Text>), this.props.users.map(u => (
              <Text key={u} type='BodySemibold' style={{...tlfTextStyle, ...(this.props.selfUsername === u ? globalStyles.italic : {})}}>{u}</Text>
            )))}
          </Box>
        </Box>
        <PopupMenu menuCatcherStyle={{alignItems: 'flex-end', top: 12, right: 12}} items={this.props.popupMenuItems} visible={this.props.visiblePopupMenu} onHidden={this.props.onTogglePopupMenu} />
        <Box style={{...globalStyles.flexBoxColumn}}>
          {this.props.recentFilesSection.map(s => this._renderSection(s))}
        </Box>

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
  fontSize: 12
}

const backButtonColorThemed = {
  'private': globalColors.white,
  'public': globalColors.white
}

function styleMenuColorThemed (theme, showingMenu): string {
  return theme === 'public'
    ? (showingMenu ? globalColors.black_40 : globalColors.white)
    : (showingMenu ? globalColors.blue3 : globalColors.white)
}
