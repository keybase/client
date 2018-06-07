// @flow
import * as React from 'react'
import {
  Box,
  Box2,
  Text,
  Icon,
  Checkbox,
  ClickableBox,
  CopyText,
  Button,
  Avatar,
  Meta,
  Usernames,
} from '../../common-adapters'

import {
  globalStyles,
  globalColors,
  globalMargins,
  platformStyles,
  styleSheetCreate,
  isMobile,
} from '../../styles'

type Props = {
  canDelete: boolean,
  canEdit: boolean,
  channelName: ?string,
  chatDisabled: boolean,
  devicename: string,
  expanded: boolean,
  lastEditTime: string,
  lastEditUser: string,
  lastEditUserFollowing: boolean,
  name: string,
  you: ?string,
  teamname: ?string,
  url: string,
  isNew: boolean,
  onCopy: () => void,
  onClickDevice: () => void,
  onShowDelete: () => void,
  onChannelClick: (SyntheticEvent<>) => void,
  onToggleChatEnabled: () => void,
  onToggleExpand: () => void,
  openUserTracker: (username: string) => void,
}

class Row extends React.Component<Props> {
  _channelNameToString = (channelName: ?string) => {
    return channelName ? `#${channelName}` : '#general'
  }

  render() {
    return (
      <Box>
        <Box
          style={{
            ...(this.props.expanded
              ? {
                  height: 6,
                  backgroundColor: globalColors.blue5,
                }
              : {}),
          }}
        />
        <Box
          style={{
            ..._rowStyle,
            ...(this.props.expanded
              ? {
                  backgroundColor: globalColors.white,
                  borderBottomWidth: 1,
                  borderColor: globalColors.black_05,
                  borderStyle: 'solid',
                  borderTopWidth: 1,
                  paddingBottom: globalMargins.tiny,
                  paddingTop: globalMargins.xtiny,
                }
              : {}),
          }}
        >
          <ClickableBox
            onClick={this.props.onToggleExpand}
            style={this.props.expanded ? _rowClickStyleExpanded : _rowClickStyle}
            hoverColor={isMobile ? undefined : globalColors.transparent}
            underlayColor={globalColors.transparent}
          >
            <Box style={_rowTopStyle}>
              <Icon
                type={this.props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
                style={_iconCaretStyle}
                fontSize={isMobile ? 12 : 8}
              />
              <Avatar
                size={isMobile ? 48 : 32}
                isTeam={!!this.props.teamname}
                teamname={this.props.teamname}
                username={this.props.teamname ? undefined : this.props.you}
                style={{marginRight: globalMargins.tiny}}
              />
              <Text type="BodySemibold" style={{color: globalColors.darkBlue}}>
                {this.props.teamname ? `${this.props.teamname}/${this.props.name}` : this.props.name}
              </Text>
              {this.props.isNew && (
                <Meta title="new" style={_metaStyle} backgroundColor={globalColors.orange} />
              )}
            </Box>
          </ClickableBox>
          {this.props.expanded && (
            <Box style={_rowBottomStyle}>
              <Box
                style={{
                  ...globalStyles.flexBoxRow,
                  alignItems: 'center',
                  position: 'relative',
                }}
              >
                <Text type="Body">Clone:</Text>
                <Box2 direction="horizontal" style={styles.copyTextContainer}>
                  <CopyText text={this.props.url} />
                </Box2>
                {!isMobile &&
                  this.props.canDelete && (
                    <Button
                      type="Danger"
                      small={true}
                      label="Delete repo"
                      onClick={this.props.onShowDelete}
                    />
                  )}
              </Box>
              <Box
                style={{
                  ...globalStyles.flexBoxRow,
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  flexWrap: 'wrap',
                  marginTop: globalMargins.tiny,
                }}
              >
                <Text type="BodySmall">
                  {`Last push ${this.props.lastEditTime}${
                    !!this.props.teamname && !!this.props.lastEditUser ? ' by ' : ''
                  }`}
                </Text>
                {!!this.props.teamname &&
                  !!this.props.lastEditUser && (
                    <Avatar
                      username={this.props.lastEditUser}
                      size={16}
                      style={{marginLeft: isMobile ? 0 : 4}}
                    />
                  )}
                {!!this.props.teamname &&
                  !!this.props.lastEditUser && (
                    <Box style={{marginLeft: 2}}>
                      <Usernames
                        type="BodySmallSemibold"
                        underline={true}
                        colorFollowing={true}
                        users={[
                          {following: this.props.lastEditUserFollowing, username: this.props.lastEditUser},
                        ]}
                        onUsernameClicked={() => this.props.openUserTracker(this.props.lastEditUser)}
                      />
                    </Box>
                  )}
                {isMobile && <Text type="BodySmall">. </Text>}
                <Text type="BodySmall">
                  <Text type="BodySmall">
                    {isMobile ? 'Signed and encrypted using device' : ', signed and encrypted using device'}
                  </Text>
                  <Text type="BodySmall" style={_deviceStyle} onClick={this.props.onClickDevice}>
                    {' '}
                    {this.props.devicename}
                  </Text>
                  <Text type="BodySmall">.</Text>
                </Text>
              </Box>
              {!!this.props.teamname && (
                <Box style={{...globalStyles.flexBoxRow, alignItems: 'center'}}>
                  {this.props.canEdit && (
                    <Checkbox
                      checked={!this.props.chatDisabled}
                      onCheck={this.props.onToggleChatEnabled}
                      label=""
                      labelComponent={
                        <Text type="BodySmall">
                          Announce pushes in{' '}
                          <Text
                            type={this.props.chatDisabled ? 'BodySmall' : 'BodySmallPrimaryLink'}
                            onClick={this.props.onChannelClick}
                          >
                            {this._channelNameToString(this.props.channelName)}
                          </Text>
                        </Text>
                      }
                    />
                  )}
                  {!this.props.canEdit && (
                    <Text type="BodySmall">
                      {this.props.chatDisabled
                        ? 'Pushes are not announced'
                        : `Pushes are announced in ${this.props.teamname}${this._channelNameToString(
                            this.props.channelName
                          )}`}
                    </Text>
                  )}
                </Box>
              )}
              {isMobile &&
                this.props.canDelete && (
                  <Button
                    type="Danger"
                    small={false}
                    label="Delete repo"
                    onClick={this.props.onShowDelete}
                    style={{marginTop: globalMargins.tiny, alignSelf: 'flex-start'}}
                  />
                )}
            </Box>
          )}
        </Box>
        <Box
          style={{
            ...(this.props.expanded
              ? {
                  height: 6,
                  backgroundColor: globalColors.blue5,
                }
              : {}),
          }}
        />
      </Box>
    )
  }
}

const styles = styleSheetCreate({
  copyTextContainer: {
    marginLeft: globalMargins.xtiny,
    marginRight: globalMargins.tiny,
  },
})

const _deviceStyle = {
  ...globalStyles.fontSemibold,
  ...globalStyles.italic,
  color: globalColors.black_60,
}

const _rowBottomStyle = {
  ...globalStyles.flexBoxColumn,
  paddingLeft: globalMargins.medium,
  paddingBottom: globalMargins.tiny,
}

const _iconCaretStyle = platformStyles({
  common: {
    marginBottom: 2,
    marginRight: globalMargins.tiny,
  },
  isElectron: {
    display: 'inline-block',
  },
})

const _metaStyle = {
  alignSelf: 'center',
  marginLeft: 6,
}

const _rowTopStyle = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: globalMargins.tiny,
  marginBottom: globalMargins.xtiny,
}

const _rowStyle = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  flexShrink: 0,
  minHeight: globalMargins.large,
  paddingLeft: 0,
  width: '100%',
}
const _rowClickStyle = {
  ...globalStyles.flexBoxColumn,
  paddingTop: globalMargins.tiny,
  paddingBottom: globalMargins.tiny,
  width: '100%',
}

const _rowClickStyleExpanded = {
  ..._rowClickStyle,
  paddingBottom: 0,
}

export default Row
