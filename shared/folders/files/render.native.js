// @flow
import File from './file/render'
import React, {Component} from 'react'
import {
  Box,
  Button,
  Text,
  BackButton,
  Avatar,
  Icon,
  Usernames,
  NativeScrollView,
  ListItem,
  NativeStyleSheet,
} from '../../common-adapters/index.native'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {intersperseFn} from '../../util/arrays'

import type {IconType} from '../../common-adapters/icon'
import type {FileSection} from '../../constants/folders'
import type {Props} from './render'

const RenderIgnore = ({isPrivate, ignored, unIgnoreCurrentFolder, ignoreCurrentFolder}) =>
  ignored
    ? <Button type="Secondary" onClick={unIgnoreCurrentFolder} label="Unignore folder" />
    : <Button type="Secondary" onClick={ignoreCurrentFolder} label="Ignore folder" />

const RenderNotImplemented = ({
  isPrivate,
  allowIgnore,
  ignored,
  unIgnoreCurrentFolder,
  ignoreCurrentFolder,
}) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center'}}>
      <Text style={{textAlign: 'center'}} type="BodySmall">Mobile files coming soon!</Text>
      <Text style={{textAlign: 'center', marginBottom: globalMargins.large}} type="BodySmall">
        For now you can browse this folder on your computer.
      </Text>
      {allowIgnore &&
        <RenderIgnore
          isPrivate={isPrivate}
          ignored={ignored}
          unIgnoreCurrentFolder={unIgnoreCurrentFolder}
          ignoreCurrentFolder={ignoreCurrentFolder}
        />}
    </Box>
  )
}

const Divider = () => (
  <Box style={{...globalStyles.flexBoxRow, height: 1}}>
    <Box style={{marginLeft: 48 + 8, backgroundColor: globalColors.black_05, flex: 1}} />
  </Box>
)

const ParticipantUnlock = ({waitingForParticipantUnlock, isPrivate, backgroundMode, theme}) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Text type="BodySemibold" style={styleWarningBanner}>
        This folder is waiting for either participant to turn on a device.
      </Text>
      <NativeScrollView style={{...globalStyles.flexBoxColumn, flex: 1}}>
        <Box
          style={{
            marginTop: globalMargins.small,
            paddingLeft: globalMargins.small,
            paddingRight: globalMargins.small,
          }}
        >
          {intersperseFn(
            i => <Divider key={i} />,
            waitingForParticipantUnlock.map(p => (
              <ListItem
                key={p.name}
                type="Large"
                action={<Box />}
                icon={<Avatar size={40} username={p.name} />}
                body={
                  <Box style={globalStyles.flexBoxColumn}>
                    <Text type="BodySemibold">{p.name}</Text>
                    <Text type="BodySmall">{p.devices}</Text>
                  </Box>
                }
              />
            ))
          )}
        </Box>
      </NativeScrollView>
    </Box>
  )
}
const deviceIcon: (isPrivate: boolean, type: string) => IconType = (isPrivate, type) =>
  ({
    private: {
      backup: 'icon-paper-key-dark-blue-32',
      desktop: 'icon-computer-dark-blue-32',
      mobile: 'icon-phone-dark-blue-32',
    },
    public: {
      backup: 'icon-paper-key-32',
      desktop: 'icon-computer-32',
      mobile: 'icon-phone-32',
    },
  }[isPrivate ? 'private' : 'public'][type])

const YouCanUnlock = ({youCanUnlock, isPrivate, onClickPaperkey, theme}) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Text type="BodySemibold" style={styleWarningBanner}>
        Until you take one of the steps below, you're at risk of losing data forever.
      </Text>
      <NativeScrollView
        style={{
          ...globalStyles.flexBoxColumn,
          flex: 1,
          marginTop: globalMargins.small,
          paddingLeft: globalMargins.small,
          paddingRight: globalMargins.small,
        }}
      >
        {intersperseFn(
          i => <Divider key={i} />,
          youCanUnlock.map(device => (
            <ListItem
              key={device.name}
              type="Large"
              action={
                device.type === 'backup'
                  ? <Button
                      label="Enter paper key"
                      onClick={() => onClickPaperkey(device)}
                      type="Secondary"
                    />
                  : <Box />
              }
              icon={<Icon type={deviceIcon(isPrivate, device.type)} />}
              body={
                <Box style={{...globalStyles.flexBoxColumn}}>
                  <Text type="Body">{device.name}</Text>
                  {device.type !== 'backup' && <Text type="BodySmall">Open the Keybase app</Text>}
                </Box>
              }
            />
          ))
        )}
      </NativeScrollView>
    </Box>
  )
}

class FilesRender extends Component<void, Props, void> {
  _renderSection(section: FileSection) {
    return (
      <Box key={section.name} style={{...globalStyles.flexBoxColumn}}>
        <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', height: 32}}>
          <Box key={section.name} style={{...globalStyles.flexBoxRow, marginLeft: globalMargins.tiny}}>
            {section.modifiedMarker &&
              <Icon
                type="iconfont-thunderbolt"
                style={{
                  marginRight: 6,
                  alignSelf: 'center',
                  fontSize: 10,
                  ...styleSectionTextThemed[this.props.theme],
                }}
              />}
            <Text type="BodySmallSemibold" style={styleSectionTextThemed[this.props.theme]}>
              {section.name}
            </Text>
          </Box>
        </Box>
        {intersperseFn(
          i => <Box key={i} style={{height: 0.5, backgroundColor: globalColors.black_10}} />,
          section.files.map(f => <File key={f.name} {...f} />)
        )}
      </Box>
    )
  }

  // TODO render checkerboard pattern for private mode
  _renderHeader() {
    const contents = (
      <Box
        style={{
          ...globalStyles.flexBoxRow,
          justifyContent: 'space-between',
          backgroundColor: globalColors.white,
          height: 48,
        }}
      >
        <BackButton title={null} onClick={this.props.onBack} style={{marginLeft: globalMargins.small}} />
      </Box>
    )
    return contents
  }

  _renderContents(isPrivate: boolean, ignored: boolean, allowIgnore: boolean) {
    if (this.props.youCanUnlock.length) {
      return (
        <YouCanUnlock
          youCanUnlock={this.props.youCanUnlock}
          isPrivate={isPrivate}
          theme={this.props.theme}
          onClickPaperkey={this.props.onClickPaperkey}
        />
      )
    }

    if (this.props.waitingForParticipantUnlock.length) {
      return (
        <ParticipantUnlock
          waitingForParticipantUnlock={this.props.waitingForParticipantUnlock}
          isPrivate={isPrivate}
          theme={this.props.theme}
        />
      )
    }

    if (!this.props.recentFilesEnabled) {
      return (
        <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
          {
            <RenderNotImplemented
              isPrivate={isPrivate}
              allowIgnore={allowIgnore}
              ignored={ignored}
              unIgnoreCurrentFolder={this.props.unIgnoreCurrentFolder}
              ignoreCurrentFolder={this.props.ignoreCurrentFolder}
            />
          }
        </Box>
      )
    } else {
      return (
        <NativeScrollView>{this.props.recentFilesSection.map(s => this._renderSection(s))}</NativeScrollView>
      )
    }
  }

  render() {
    const isPrivate = this.props.theme === 'private'

    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          flexGrow: 1,
          position: 'relative',
        }}
      >
        {this._renderHeader()}
        <Box style={{...styleTLFHeader}}>
          <Usernames
            prefix={isPrivate ? 'private/' : 'public/'}
            users={this.props.users}
            type="BodySemibold"
            containerStyle={{textAlign: 'center'}}
            style={{color: isPrivate ? globalColors.darkBlue : globalColors.yellowGreen2}}
          />
        </Box>
        {this._renderContents(isPrivate, this.props.ignored, this.props.allowIgnore)}
      </Box>
    )
  }
}

const styleTLFHeader = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'stretch',
  borderBottomColor: globalColors.black_05,
  borderBottomWidth: NativeStyleSheet.hairlineWidth,
  flexGrow: 0,
  justifyContent: 'center',
  minHeight: 56,
  paddingBottom: globalMargins.tiny,
  paddingTop: globalMargins.tiny,
}

const styleSectionTextThemed = {
  public: {
    color: globalColors.black_40,
  },
  private: {
    color: globalColors.blue3_40,
  },
}

const styleWarningBanner = {
  backgroundColor: globalColors.red,
  color: globalColors.white,
  minHeight: 40,
  paddingBottom: globalMargins.tiny,
  paddingTop: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  textAlign: 'center',
  width: '100%',
}

export default FilesRender
