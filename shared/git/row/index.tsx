import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  canDelete: boolean
  canEdit: boolean
  channelName: string | null
  chatDisabled: boolean
  devicename: string
  expanded: boolean
  lastEditTime: string
  lastEditUser: string
  lastEditUserFollowing: boolean
  name: string
  you: string | null
  teamname: string | null
  url: string
  isNew: boolean
  onBrowseGitRepo: () => void
  onCopy: () => void
  onClickDevice: () => void
  onShowDelete: () => void
  onChannelClick: (syntheticEvent: React.SyntheticEvent) => void
  onToggleChatEnabled: () => void
  onToggleExpand: () => void
  openUserTracker: (username: string) => void
  _onOpenChannelSelection: () => void
}

// TODO use ListItem2
class Row extends React.Component<Props> {
  _channelNameToString = (channelName: string | null) => {
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
                sizeType="Tiny"
              />
              <Kb.Avatar
                size={Styles.isMobile ? 48 : 32}
                isTeam={!!this.props.teamname}
                teamname={this.props.teamname}
                username={this.props.teamname ? undefined : this.props.you}
                style={{marginRight: Styles.globalMargins.tiny}}
              />
              <Kb.Text type="BodySemibold" style={{color: Styles.globalColors.black}}>
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
              </Kb.Box>
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
              <Kb.Box2
                direction="horizontal"
                fullWidth={true}
                style={{marginTop: Styles.globalMargins.tiny}}
                gap="tiny"
              >
                <Kb.Button
                  type="Dim"
                  mode="Secondary"
                  small={true}
                  label="View files"
                  onClick={this.props.onBrowseGitRepo}
                >
                  <Kb.Icon
                    type="iconfont-file"
                    sizeType="Small"
                    color={Styles.globalColors.black_50}
                    style={{marginRight: Styles.globalMargins.xtiny}}
                  />
                </Kb.Button>
                {this.props.canDelete && (
                  <Kb.Button
                    type="Danger"
                    mode="Secondary"
                    small={true}
                    label="Delete repo"
                    onClick={this.props.onShowDelete}
                  />
                )}
              </Kb.Box2>
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
} as const

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
