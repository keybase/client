// @flow
import File from './file/render'
import React, {Component} from 'react'
import type {FileSection} from '../../constants/folders'
import type {Props} from './render'
import {Box, Button, Text, BackButton, Icon, Usernames, NativeScrollView, NativeStyleSheet} from '../../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins, statusBarHeight} from '../../styles'
import {intersperseFn} from '../../util/arrays'

const RenderIgnore = ({isPrivate, ignored, unIgnoreCurrentFolder, ignoreCurrentFolder}) => (
  ignored
  ? <Button type='Secondary' onClick={unIgnoreCurrentFolder} label='Unignore folder' />
  : <Button backgroundMode={isPrivate ? 'Terminal' : 'Normal'} type='Secondary' onClick={ignoreCurrentFolder} label='Ignore folder' />
)

const RenderNotImplemented = ({isPrivate, allowIgnore, ignored, unIgnoreCurrentFolder, ignoreCurrentFolder}) => {
  const privateStyle = isPrivate ? {color: globalColors.blue3_40} : {}
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center'}}>
      <Text style={{...privateStyle, textAlign: 'center'}} type='BodySmall'>Mobile files coming soon!</Text>
      <Text style={{...privateStyle, textAlign: 'center', marginBottom: globalMargins.large}} type='BodySmall'>For now you can browse this folder on your computer.</Text>
      {allowIgnore && <RenderIgnore isPrivate={isPrivate} ignored={ignored} unIgnoreCurrentFolder={unIgnoreCurrentFolder} ignoreCurrentFolder={ignoreCurrentFolder} />}
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
    const backButtonColor = backButtonColorThemed[this.props.theme]

    const contents = (
      <Box style={{...globalStyles.flexBoxRow, justifyContent: 'space-between', ...styleHeaderThemed[this.props.theme], height: 48}}>
        <BackButton title={null} onClick={this.props.onBack} style={{marginLeft: globalMargins.small}} iconStyle={{color: backButtonColor}} textStyle={{color: backButtonColor}} />
      </Box>
    )

    return contents
  }

  _renderContents (isPrivate: boolean, ignored: boolean, allowIgnore: boolean) {
    if (!this.props.recentFilesEnabled) {
      return (
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          {allowIgnore && <RenderIgnore isPrivate={isPrivate} ignored={ignored} unIgnoreCurrentFolder={this.props.unIgnoreCurrentFolder} ignoreCurrentFolder={this.props.ignoreCurrentFolder} />}
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
          <Usernames prefix={isPrivate ? 'private/' : 'public/'} users={this.props.users} type='BodySemibold' style={tlfTextStyle} containerStyle={{textAlign: 'center'}} />
        </Box>
        {this.props.notImplemented
          ? <RenderNotImplemented isPrivate={isPrivate} allowIgnore={this.props.allowIgnore} ignored={this.props.ignored} unIgnoreCurrentFolder={this.props.unIgnoreCurrentFolder} ignoreCurrentFolder={this.props.ignoreCurrentFolder} />
          : this._renderContents(isPrivate, this.props.ignored, this.props.allowIgnore)}
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
  minHeight: 56,
  alignItems: 'stretch',
  justifyContent: 'center',
  flexGrow: 0,
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: NativeStyleSheet.hairlineWidth,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
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
  'public': globalColors.white,
  'private': globalColors.darkBlue3,
}

const backButtonColorThemed = {
  'private': globalColors.white,
  'public': globalColors.white,
}

export default FilesRender
