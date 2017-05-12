// @flow
import File from './file/render'
import React, {Component} from 'react'
import type {IconType} from '../../common-adapters/icon'
import type {Props} from './render'
import {
  Box,
  Text,
  BackButton,
  Avatar,
  PopupMenu,
  Icon,
  Usernames,
  ListItem,
  Button,
} from '../../common-adapters'
import {
  globalStyles,
  globalColors,
  globalMargins,
  backgroundURL,
} from '../../styles'
import {intersperseFn} from '../../util/arrays'

const Divider = ({theme, backgroundColor, color}) => (
  <Box style={{...globalStyles.flexBoxRow, height: 1, backgroundColor}}>
    <Box style={{marginLeft: 48 + 8, backgroundColor: color, flex: 1}} />
  </Box>
)

const Section = ({section, theme}) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      backgroundColor: backgroundColorThemed[theme],
    }}
  >
    <Box
      style={{
        ...globalStyles.flexBoxRow,
        alignItems: 'center',
        height: globalMargins.medium,
      }}
    >
      <Box
        key={section.name}
        style={{display: 'inline', marginLeft: globalMargins.tiny}}
      >
        {section.modifiedMarker &&
          <Icon
            type="iconfont-thunderbolt"
            style={{
              fontSize: 14,
              marginTop: 2,
              marginRight: 6,
              ...styleSectionTextThemed[theme],
            }}
          />}
        <Text
          type="BodySmallSemibold"
          style={{...styleSectionTextThemed[theme]}}
        >
          {section.name}
        </Text>
      </Box>
    </Box>
    {intersperseFn(
      i => (
        <Divider
          key={i}
          backgroundColor={styleDividerThemed[theme].backgroundColor}
          color={styleDividerThemed[theme].color}
        />
      ),
      section.files.map(f => <File key={f.name} {...f} />)
    )}
  </Box>
)

const ParticipantUnlock = ({
  waitingForParticipantUnlock,
  isPrivate,
  backgroundMode,
  theme,
}) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Text type="BodySemibold" style={styleWarningBanner}>
        This folder is waiting for either participant to turn on a device.
      </Text>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          marginTop: 38,
          paddingLeft: globalMargins.xlarge,
          paddingRight: globalMargins.xlarge,
        }}
      >
        {intersperseFn(
          i => (
            <Divider
              key={i}
              color={isPrivate ? globalColors.black_10 : globalColors.black_05}
              backgroundColor={
                isPrivate ? globalColors.darkBlue3 : globalColors.lightGrey
              }
            />
          ),
          waitingForParticipantUnlock.map(p => (
            <ListItem
              key={p.name}
              type="Large"
              action={<Box />}
              icon={<Avatar size={40} username={p.name} />}
              body={
                <Box style={{...globalStyles.flexBoxColumn}}>
                  <Text type="Body" backgroundMode={backgroundMode}>
                    {p.name}
                  </Text>
                  <Text type="BodySmall" backgroundMode={backgroundMode}>
                    {p.devices}
                  </Text>
                </Box>
              }
            />
          ))
        )}
      </Box>
    </Box>
  )
}

const deviceIcon: (isPrivate: boolean, type: string) => IconType = (
  isPrivate,
  type
) =>
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

const YouCanUnlock = ({
  youCanUnlock,
  isPrivate,
  backgroundMode,
  onClickPaperkey,
  theme,
}) => {
  return (
    <Box style={{...globalStyles.flexBoxColumn}}>
      <Text type="BodySemibold" style={styleWarningBanner}>
        Until you take one of the steps below, you're at risk of losing data forever.
      </Text>
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          marginTop: 38,
          paddingLeft: globalMargins.xlarge,
          paddingRight: globalMargins.xlarge,
        }}
      >
        {intersperseFn(
          i => <Divider key={i} theme={theme} />,
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
                      backgroundMode={backgroundMode}
                    />
                  : <Box />
              }
              icon={<Icon type={deviceIcon(isPrivate, device.type)} />}
              body={
                <Box style={{...globalStyles.flexBoxColumn}}>
                  <Text type="Body" backgroundMode={backgroundMode}>
                    {device.name}
                  </Text>
                  {device.type !== 'backup' &&
                    <Text type="BodySmall" backgroundMode={backgroundMode}>
                      Open the Keybase app
                    </Text>}
                </Box>
              }
            />
          ))
        )}
      </Box>
    </Box>
  )
}

class FilesRender extends Component<void, Props, void> {
  _renderContents(
    hasReadOnlyUsers: boolean,
    isPrivate: boolean,
    ignored: boolean,
    allowIgnore: boolean
  ) {
    const backgroundMode = isPrivate ? 'Terminal' : 'Normal'

    if (this.props.youCanUnlock.length) {
      return (
        <YouCanUnlock
          youCanUnlock={this.props.youCanUnlock}
          isPrivate={isPrivate}
          backgroundMode={backgroundMode}
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
          backgroundMode={backgroundMode}
        />
      )
    }

    if (!this.props.recentFilesEnabled) {
      return (
        <Box style={styleRecentFilesNotEnabled}>
          <Button
            key="open"
            type="Primary"
            onClick={this.props.openCurrentFolder}
            label="Open folder"
            style={{marginBottom: globalMargins.small}}
          />
          {isPrivate &&
            !hasReadOnlyUsers &&
            <Button
              key="chat"
              type="Secondary"
              onClick={this.props.openConversationFromFolder}
              label="Open in chat"
              style={{marginBottom: globalMargins.small, marginRight: 0}}
            />}

          {ignored
            ? allowIgnore &&
                <Button
                  type="Secondary"
                  onClick={this.props.unIgnoreCurrentFolder}
                  label="Unignore folder"
                  style={{marginRight: 0}}
                />
            : allowIgnore &&
                <Button
                  type="Secondary"
                  onClick={this.props.ignoreCurrentFolder}
                  label="Ignore folder"
                  style={{marginRight: 0}}
                />}
        </Box>
      )
    }

    if (this.props.recentFilesSection.length) {
      return (
        <Box style={globalStyles.flexBoxColumn}>
          {this.props.recentFilesSection.map(s => (
            <Section key={s.name} section={s} theme={this.props.theme} />
          ))}
        </Box>
      )
    } else {
      return (
        <Box style={styleNoFiles}>
          <Text type="Body" backgroundMode={backgroundMode}>
            This folder is empty.
          </Text>
          <Text
            type="BodyPrimaryLink"
            onClick={this.props.openCurrentFolder}
            backgroundMode={backgroundMode}
          >
            Open folder
          </Text>
        </Box>
      )
    }
  }

  render() {
    const isPrivate = this.props.theme === 'private'
    const menuColor = styleMenuColorThemed(
      this.props.theme,
      this.props.visiblePopupMenu
    )
    const backButtonColor = backButtonColorThemed[this.props.theme]
    const tlfTextStyle = styleTLFTextThemed[this.props.theme]

    return (
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          flex: 1,
          position: 'relative',
          backgroundColor: backgroundColorThemed[this.props.theme],
        }}
      >
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            ...styleHeaderThemed[this.props.theme],
            height: 48,
          }}
        >
          <BackButton
            onClick={this.props.onBack}
            style={{marginLeft: 16}}
            iconStyle={{color: backButtonColor}}
            textStyle={{color: backButtonColor}}
          />
          {this.props.recentFilesEnabled &&
            <Icon
              style={{
                ...styleMenu,
                color: menuColor,
                hoverColor: menuColor,
                marginRight: 16,
                position: 'relative',
                top: 14,
              }}
              type="iconfont-hamburger"
              onClick={this.props.onTogglePopupMenu}
            />}
        </Box>
        <Box
          style={{
            ...globalStyles.flexBoxColumn,
            ...styleTLFHeader,
            ...styleTLFHeaderThemed[this.props.theme],
          }}
        >
          <Box
            style={{
              ...globalStyles.flexBoxRow,
              height: 0,
              justifyContent: 'center',
              position: 'relative',
              bottom: 16,
            }}
          >
            {this.props.users.map(u => (
              <Box key={u.username} style={{height: 32, width: 28}}>
                <Avatar username={u.username} size={32} />
              </Box>
            ))}
          </Box>
          <Box style={styleTLFNameContainer}>
            <Text type="BodySemibold" style={tlfTextStyle}>
              {isPrivate ? 'private/' : 'public/'}
            </Text>
            <Usernames
              users={this.props.users}
              type="Header"
              style={tlfTextStyle}
            />
          </Box>
        </Box>
        {this.props.visiblePopupMenu &&
          <PopupMenu
            style={{
              marginLeft: 'auto',
              marginRight: 8,
              marginTop: 36,
              width: 320,
            }}
            items={this.props.popupMenuItems}
            onHidden={this.props.onTogglePopupMenu}
          />}
        {this._renderContents(
          this.props.hasReadOnlyUsers,
          isPrivate,
          this.props.ignored,
          this.props.allowIgnore
        )}
      </Box>
    )
  }
}

const styleHeaderThemed = {
  private: {
    background: `${backgroundURL('icons', 'icon-damier-pattern-good-open.png')} ${globalColors.darkBlue3} repeat`,
  },

  public: {
    backgroundColor: globalColors.yellowGreen,
  },
}

const styleTLFHeader = {
  minHeight: globalMargins.xlarge,
  alignItems: 'center',
}

const styleTLFNameContainer = {
  ...globalStyles.flexBoxRow,
  alignItems: 'baseline',
  marginBottom: 'auto',
  marginTop: 'auto',
  paddingLeft: globalMargins.xlarge,
  paddingRight: globalMargins.xlarge,
  paddingTop: 22,
  paddingBottom: 20,
}

const styleDividerThemed = {
  private: {
    color: globalColors.black_10,
    backgroundColor: globalColors.darkBlue,
  },

  public: {
    color: globalColors.black_05,
    backgroundColor: globalColors.white,
  },
}
const styleTLFHeaderThemed = {
  private: {
    backgroundColor: globalColors.darkBlue,
  },

  public: {
    backgroundColor: globalColors.white,
  },
}

const styleTLFTextThemed = {
  private: {
    color: globalColors.white,
  },

  public: {
    color: globalColors.yellowGreen,
  },
}

const styleSectionTextThemed = {
  public: {
    color: globalColors.black_40,
  },
  private: {
    color: globalColors.blue3_40,
  },
}

const backgroundColorThemed = {
  public: globalColors.lightGrey,
  private: globalColors.darkBlue3,
}

const styleMenu = {
  ...globalStyles.clickable,
  marginLeft: 'auto',
  fontSize: 24,
}

const backButtonColorThemed = {
  private: globalColors.white,
  public: globalColors.white,
}

const styleRecentFilesNotEnabled = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: globalMargins.xlarge,
}

const styleNoFiles = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  justifyContent: 'center',
  alignItems: 'center',
  padding: globalMargins.xlarge,
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

function styleMenuColorThemed(theme, showingMenu): string {
  return theme === 'public'
    ? showingMenu ? globalColors.black_40 : globalColors.white
    : showingMenu ? globalColors.blue3 : globalColors.white
}

export default FilesRender
