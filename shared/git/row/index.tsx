import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {
  canDelete: boolean
  canEdit: boolean
  channelName?: string
  chatDisabled: boolean
  devicename: string
  expanded: boolean
  lastEditTime: string
  lastEditUser: string
  lastEditUserFollowing: boolean
  name: string
  you?: string
  teamname?: string
  url: string
  isNew: boolean
  onBrowseGitRepo: () => void
  onCopy: () => void
  onClickDevice: () => void
  onShowDelete: () => void
  onChannelClick: (syntheticEvent: React.BaseSyntheticEvent) => void
  onToggleChatEnabled: () => void
  onToggleExpand: () => void
  openUserTracker: (username: string) => void
  _onOpenChannelSelection: () => void
}

const channelNameToString = (channelName?: string) => (channelName ? `#${channelName}` : '#general')

// TODO use ListItem2
const Row = (props: Props) => (
  <Kb.Box style={{width: '100%'}}>
    <Kb.Box
      style={{
        ...(props.expanded
          ? {
              backgroundColor: Styles.globalColors.blueLighter3,
              height: 6,
            }
          : {}),
      }}
    />
    <Kb.Box
      style={{
        ..._rowStyle,
        ...(props.expanded
          ? {
              backgroundColor: Styles.globalColors.white,
              paddingBottom: Styles.globalMargins.tiny,
              paddingTop: Styles.globalMargins.xtiny,
            }
          : {}),
      }}
    >
      <Kb.ClickableBox
        onClick={props.onToggleExpand}
        style={props.expanded ? _rowClickStyleExpanded : _rowClickStyle}
        hoverColor={Styles.isMobile ? undefined : Styles.globalColors.transparent}
        underlayColor={Styles.globalColors.transparent}
      >
        <Kb.Box style={_rowTopStyle}>
          <Kb.Icon
            type={props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
            style={_iconCaretStyle}
            sizeType="Tiny"
          />
          <Kb.Avatar
            size={Styles.isMobile ? 48 : 32}
            isTeam={!!props.teamname}
            teamname={props.teamname}
            username={props.teamname ? undefined : props.you}
            style={{marginRight: Styles.globalMargins.tiny}}
          />
          <Kb.Text type="BodySemibold" style={{color: Styles.globalColors.black}}>
            {props.teamname ? `${props.teamname}/${props.name}` : props.name}
          </Kb.Text>
          {props.isNew && (
            <Kb.Meta title="new" style={_metaStyle} backgroundColor={Styles.globalColors.orange} />
          )}
        </Kb.Box>
      </Kb.ClickableBox>
      {props.expanded && (
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
              <Kb.CopyText text={props.url} containerStyle={{width: '100%'}} />
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
              {`Last push ${props.lastEditTime}${!!props.teamname && !!props.lastEditUser ? ' by ' : ''}`}
            </Kb.Text>
            {!!props.teamname && !!props.lastEditUser && (
              <Kb.Avatar
                username={props.lastEditUser}
                size={16}
                style={{marginLeft: Styles.isMobile ? 0 : 4}}
              />
            )}
            {!!props.teamname && !!props.lastEditUser && (
              <Kb.Box style={{marginLeft: 2}}>
                <Kb.Usernames
                  type="BodySmallSemibold"
                  underline={true}
                  colorFollowing={true}
                  users={[{following: props.lastEditUserFollowing, username: props.lastEditUser}]}
                  onUsernameClicked={() => props.openUserTracker(props.lastEditUser)}
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
              <Kb.Text type="BodySmall" style={_deviceStyle} onClick={props.onClickDevice}>
                {' '}
                {props.devicename}
              </Kb.Text>
              <Kb.Text type="BodySmall">.</Kb.Text>
            </Kb.Text>
          </Kb.Box>
          {!!props.teamname && (
            <Kb.Box style={{...Styles.globalStyles.flexBoxRow, alignItems: 'center'}}>
              {props.canEdit && (
                <Kb.Checkbox
                  checked={!props.chatDisabled}
                  onCheck={props.onToggleChatEnabled}
                  label=""
                  labelComponent={
                    <Kb.Text type="BodySmall">
                      Announce pushes in{' '}
                      <Kb.Text
                        type={props.chatDisabled ? 'BodySmall' : 'BodySmallPrimaryLink'}
                        onClick={props.onChannelClick}
                      >
                        {channelNameToString(props.channelName)}
                      </Kb.Text>
                    </Kb.Text>
                  }
                />
              )}
              {!props.canEdit && (
                <Kb.Text type="BodySmall">
                  {props.chatDisabled
                    ? 'Pushes are not announced'
                    : `Pushes are announced in ${props.teamname}${channelNameToString(props.channelName)}`}
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
              onClick={props.onBrowseGitRepo}
            >
              <Kb.Icon
                type="iconfont-file"
                sizeType="Small"
                color={Styles.globalColors.black_50}
                style={{marginRight: Styles.globalMargins.xtiny}}
              />
            </Kb.Button>
            {props.canDelete && (
              <Kb.Button
                type="Danger"
                mode="Secondary"
                small={true}
                label="Delete repo"
                onClick={props.onShowDelete}
              />
            )}
          </Kb.Box2>
        </Kb.Box>
      )}
    </Kb.Box>
    <Kb.Box
      style={{
        ...(props.expanded
          ? {
              backgroundColor: Styles.globalColors.blueLighter3,
              height: 6,
            }
          : {}),
      }}
    />
  </Kb.Box>
)

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
