// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as FsTypes from '../../constants/types/fs'
import KbfsPathContainer from '../../common-adapters/markdown/kbfs-path-container'

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
  previewLink: string,
  _onOpenChannelSelection: () => void,
}

// TODO use ListItem2
class Row extends React.Component<Props> {
  _channelNameToString = (channelName: ?string) => {
    return channelName ? `#${channelName}` : '#general'
  }

  render() {
    return (
      <Kb.Box style={{width: '100%'}}>
        <Kb.Box
          style={{
            ...(this.props.expanded
              ? {
                  backgroundColor: Styles.globalColors.blueGrey,
                  height: 6,
                }
              : {}),
          }}
        />
        <Kb.Box
          style={{
            ..._rowStyle,
            ...(this.props.expanded
              ? {
                  backgroundColor: Styles.globalColors.white,
                  paddingBottom: Styles.globalMargins.tiny,
                  paddingTop: Styles.globalMargins.xtiny,
                }
              : {}),
          }}
        >
          <Kb.ClickableBox
            onClick={this.props.onToggleExpand}
            style={this.props.expanded ? _rowClickStyleExpanded : _rowClickStyle}
            hoverColor={Styles.isMobile ? undefined : Styles.globalColors.transparent}
            underlayColor={Styles.globalColors.transparent}
          >
            <Kb.Box style={_rowTopStyle}>
              <Kb.Icon
                type={this.props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
                style={_iconCaretStyle}
                fontSize={Styles.isMobile ? 12 : 8}
              />
              <Kb.Avatar
                size={Styles.isMobile ? 48 : 32}
                isTeam={!!this.props.teamname}
                teamname={this.props.teamname}
                username={this.props.teamname ? undefined : this.props.you}
                style={{marginRight: Styles.globalMargins.tiny}}
              />
              <Kb.Text type="BodySemibold" style={{color: Styles.globalColors.black_75}}>
                {this.props.teamname ? `${this.props.teamname}/${this.props.name}` : this.props.name}
              </Kb.Text>
              {this.props.isNew && (
                <Kb.Meta title="new" style={_metaStyle} backgroundColor={Styles.globalColors.orange} />
              )}
            </Kb.Box>
          </Kb.ClickableBox>
          {this.props.expanded && (
            <Kb.Box style={_rowBottomStyle}>
              <Kb.Box
                style={{
                  ...Styles.globalStyles.flexBoxRow,
                  alignItems: 'center',
                  maxWidth: '100%',
                  position: 'relative',
                }}
              >
                <Kb.Text type="Body">Clone:</Kb.Text>
                <Kb.Box2 direction="horizontal" style={styles.copyTextContainer}>
                  <Kb.CopyText text={this.props.url} containerStyle={{width: '100%'}} />
                </Kb.Box2>
                {!Styles.isMobile && this.props.canDelete && (
                  <Kb.Button
                    type="Danger"
                    small={true}
                    label="Delete repo"
                    onClick={this.props.onShowDelete}
                  />
                )}
              </Kb.Box>
              <Kb.Box2 direction="horizontal" fullWidth={true} style={{marginTop: Styles.globalMargins.tiny}}>
                <Kb.Text type="Body">Preview:</Kb.Text>
                <KbfsPathContainer
                  escapedPath={this.props.previewLink}
                  allowFontScaling={true}
                />
              </Kb.Box2>
              <Kb.Box
                style={{
                  ...Styles.globalStyles.flexBoxRow,
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  flexWrap: 'wrap',
                  marginTop: Styles.globalMargins.tiny,
                }}
              >
                <Kb.Text type="BodySmall">
                  {`Last push ${this.props.lastEditTime}${
                    !!this.props.teamname && !!this.props.lastEditUser ? ' by ' : ''
                  }`}
                </Kb.Text>
                {!!this.props.teamname && !!this.props.lastEditUser && (
                  <Kb.Avatar
                    username={this.props.lastEditUser}
                    size={16}
                    style={{marginLeft: Styles.isMobile ? 0 : 4}}
                  />
                )}
                {!!this.props.teamname && !!this.props.lastEditUser && (
                  <Kb.Box style={{marginLeft: 2}}>
                    <Kb.Usernames
                      type="BodySmallSemibold"
                      underline={true}
                      colorFollowing={true}
                      users={[
                        {following: this.props.lastEditUserFollowing, username: this.props.lastEditUser},
                      ]}
                      onUsernameClicked={() => this.props.openUserTracker(this.props.lastEditUser)}
                    />
                  </Kb.Box>
                )}
                {Styles.isMobile && <Kb.Text type="BodySmall">. </Kb.Text>}
                <Kb.Text type="BodySmall">
                  <Kb.Text type="BodySmall">
                    {Styles.isMobile
                      ? 'Signed and encrypted using device'
                      : ', signed and encrypted using device'}
                  </Kb.Text>
                  <Kb.Text type="BodySmall" style={_deviceStyle} onClick={this.props.onClickDevice}>
                    {' '}
                    {this.props.devicename}
                  </Kb.Text>
                  <Kb.Text type="BodySmall">.</Kb.Text>
                </Kb.Text>
              </Kb.Box>
              {!!this.props.teamname && (
                <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center'}}>
                  {this.props.canEdit && (
                    <Kb.Checkbox
                      checked={!this.props.chatDisabled}
                      onCheck={this.props.onToggleChatEnabled}
                      label=""
                      labelComponent={
                        <Kb.Text type="BodySmall">
                          Announce pushes in{' '}
                          <Kb.Text
                            type={this.props.chatDisabled ? 'BodySmall' : 'BodySmallPrimaryLink'}
                            onClick={this.props.onChannelClick}
                          >
                            {this._channelNameToString(this.props.channelName)}
                          </Kb.Text>
                        </Kb.Text>
                      }
                    />
                  )}
                  {!this.props.canEdit && (
                    <Kb.Text type="BodySmall">
                      {this.props.chatDisabled
                        ? 'Pushes are not announced'
                        : `Pushes are announced in ${this.props.teamname}${this._channelNameToString(
                            this.props.channelName
                          )}`}
                    </Kb.Text>
                  )}
                </Kb.Box>
              )}
              {Styles.isMobile && this.props.canDelete && (
                <Kb.Button
                  type="Danger"
                  small={false}
                  label="Delete repo"
                  onClick={this.props.onShowDelete}
                  style={{alignSelf: 'flex-start', marginTop: Styles.globalMargins.tiny}}
                />
              )}
            </Kb.Box>
          )}
        </Kb.Box>
        <Kb.Box
          style={{
            ...(this.props.expanded
              ? {
                  backgroundColor: Styles.globalColors.blueGrey,
                  height: 6,
                }
              : {}),
          }}
        />
      </Kb.Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  copyTextContainer: {
    flexShrink: 1,
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.tiny,
    maxWidth: 460,
    width: '100%',
  },
  repoLink: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.xtiny,
    },
    isElectron: {
      // Make text selectable. On mobile we implement that differently.
      cursor: 'text',
      userSelect: 'text',
      whiteSpace: 'pre-wrap',
      width: '100%',
      wordBreak: 'break-word',
    },
    isMobile: {
      ...Styles.globalStyles.flexBoxColumn,
    },
  }),
})

const _deviceStyle = {
  ...Styles.globalStyles.fontSemibold,
  ...Styles.globalStyles.italic,
  color: Styles.globalColors.black_50,
}

const _rowBottomStyle = {
  ...Styles.globalStyles.flexBoxColumn,
  paddingBottom: Styles.globalMargins.tiny,
  paddingLeft: Styles.globalMargins.medium,
  width: '100%',
}

const _iconCaretStyle = Styles.platformStyles({
  common: {
    marginBottom: 2,
    marginRight: Styles.globalMargins.tiny,
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
  ...Styles.globalStyles.flexBoxRow,
  alignItems: 'center',
  marginBottom: Styles.globalMargins.xtiny,
  paddingLeft: Styles.globalMargins.tiny,
}

const _rowStyle = {
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'flex-start',
  flexShrink: 0,
  minHeight: Styles.globalMargins.large,
  paddingLeft: 0,
  width: '100%',
}
const _rowClickStyle = {
  ...Styles.globalStyles.flexBoxColumn,
  paddingBottom: Styles.globalMargins.tiny,
  paddingTop: Styles.globalMargins.tiny,
  width: '100%',
}

const _rowClickStyleExpanded = {
  ..._rowClickStyle,
  paddingBottom: 0,
}

export default Row
