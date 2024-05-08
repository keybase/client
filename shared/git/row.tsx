import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import openURL from '@/util/open-url'

export const NewContext = React.createContext<ReadonlySet<string>>(new Set())

type OwnProps = {
  id: string
  expanded: boolean
  onShowDelete: (id: string) => void
  onToggleExpand: (id: string) => void
}

const noGit = C.Git.makeGitInfo()
const ConnectedRow = (ownProps: OwnProps) => {
  const {id, expanded} = ownProps
  const git = C.useGitState(s => s.idToInfo.get(id) || noGit)
  const teamID = C.useTeamsState(s => (git.teamname ? C.Teams.getTeamID(s, git.teamname) : undefined))
  const isNew = React.useContext(NewContext).has(id)
  const you = C.useCurrentUserState(s => s.username)
  const setTeamRepoSettings = C.useGitState(s => s.dispatch.setTeamRepoSettings)
  const _onBrowseGitRepo = (path: T.FS.Path) => {
    C.FS.makeActionForOpenPathInFilesTab(path)
  }
  const _onArchiveGitRepo = (gitURL: string) => {
    C.featureFlags.archive &&
      gitURL &&
      navigateAppend({
        props: {gitURL, type: 'git'} as const,
        selected: 'archiveModal',
      })
  }

  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const _onOpenChannelSelection = () => {
    teamID &&
      navigateAppend({
        props: {repoID: git.repoID, selected: git.channelName || 'general', teamID},
        selected: 'gitSelectChannel',
      })
  }
  const _setDisableChat = (disabled: boolean, repoID: string, teamname: string) => {
    setTeamRepoSettings('', teamname, repoID, disabled)
  }
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const showUser = C.useTrackerState(s => s.dispatch.showUser)
  const openUserTracker = (username: string) => {
    showUser(username, true)
  }

  const chatDisabled = git.chatDisabled

  const props = {
    _onOpenChannelSelection,
    canDelete: git.canDelete,
    canEdit: git.canDelete && !!git.teamname,
    channelName: git.channelName,
    chatDisabled,
    devicename: git.devicename,
    expanded,
    isNew,
    lastEditTime: git.lastEditTime,
    lastEditUser: git.lastEditUser,
    name: git.name,
    onArchiveGitRepo: () => _onArchiveGitRepo(git.url),
    onBrowseGitRepo: () =>
      _onBrowseGitRepo(
        T.FS.stringToPath(
          git.url.replace(/keybase:\/\/((private|public|team)\/[^/]*)\/(.*)/, '/keybase/$1/.kbfs_autogit/$3')
        )
      ),
    onChannelClick: (e: React.BaseSyntheticEvent) => {
      if (!chatDisabled) {
        e.preventDefault()
        _onOpenChannelSelection()
      }
    },
    onClickDevice: () => {
      git.lastEditUser && openURL(`https://keybase.io/${git.lastEditUser}/devices`)
    },
    onCopy: () => copyToClipboard(git.url),
    onShowDelete: () => ownProps.onShowDelete(git.id),
    onToggleChatEnabled: () => git.teamname && _setDisableChat(!git.chatDisabled, git.repoID, git.teamname),
    onToggleExpand: () => ownProps.onToggleExpand(git.id),
    openUserTracker,
    teamname: git.teamname,
    url: git.url,
    you,
  }
  return <Row {...props} />
}

export default ConnectedRow

type Props = {
  canDelete: boolean
  canEdit: boolean
  channelName?: string
  chatDisabled: boolean
  devicename: string
  expanded: boolean
  lastEditTime: string
  lastEditUser: string
  name: string
  you?: string
  teamname?: string
  url: string
  isNew: boolean
  onBrowseGitRepo: () => void
  onArchiveGitRepo: () => void
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
  <Kb.Box style={styles.container}>
    <Kb.Box style={styles.containerMobile}>
      <Kb.Box
        style={{
          ...styles.rowStyle,
          ...(props.expanded
            ? {
                backgroundColor: Kb.Styles.globalColors.white,
              }
            : {}),
        }}
      >
        <Kb.ClickableBox
          onClick={props.onToggleExpand}
          style={props.expanded ? styles.rowClickExpanded : styles.rowClick}
          hoverColor={Kb.Styles.isMobile ? undefined : Kb.Styles.globalColors.transparent}
          underlayColor={Kb.Styles.globalColors.transparent}
        >
          <Kb.Box style={styles.rowTop}>
            <Kb.Icon
              type={props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
              style={styles.iconCaret}
              sizeType="Tiny"
            />
            <Kb.Avatar
              size={Kb.Styles.isMobile ? 48 : 32}
              isTeam={!!props.teamname}
              teamname={props.teamname}
              username={props.teamname ? undefined : props.you}
              style={{marginRight: Kb.Styles.globalMargins.tiny}}
            />
            <Kb.Text lineClamp={1} type="BodySemibold" style={{color: Kb.Styles.globalColors.black}}>
              {props.teamname ? `${props.teamname}/${props.name}` : props.name}
            </Kb.Text>
            {props.isNew && (
              <Kb.Meta title="new" style={styles.meta} backgroundColor={Kb.Styles.globalColors.orange} />
            )}
          </Kb.Box>
        </Kb.ClickableBox>
        {props.expanded && (
          <Kb.Box style={styles.rowBottom}>
            <Kb.Box
              style={{
                ...Kb.Styles.globalStyles.flexBoxRow,
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
                ...Kb.Styles.globalStyles.flexBoxRow,
                alignItems: 'center',
                alignSelf: 'flex-start',
                flexWrap: 'wrap',
                marginTop: Kb.Styles.globalMargins.tiny,
              }}
            >
              <Kb.Text type="BodySmall">
                {`Last push ${props.lastEditTime}${!!props.teamname && !!props.lastEditUser ? ' by ' : ''}`}
              </Kb.Text>
              {!!props.teamname && !!props.lastEditUser && (
                <Kb.Avatar
                  username={props.lastEditUser}
                  size={16}
                  style={{marginLeft: Kb.Styles.isMobile ? 0 : 4}}
                />
              )}
              {!!props.teamname && !!props.lastEditUser && (
                <Kb.Box style={{marginLeft: 2}}>
                  <Kb.ConnectedUsernames
                    type="BodySmallBold"
                    underline={true}
                    colorFollowing={true}
                    usernames={props.lastEditUser}
                    onUsernameClicked={() => props.openUserTracker(props.lastEditUser)}
                  />
                </Kb.Box>
              )}
              {Kb.Styles.isMobile && <Kb.Text type="BodySmall">. </Kb.Text>}
              <Kb.Text type="BodySmall">
                <Kb.Text type="BodySmall">
                  {Kb.Styles.isMobile
                    ? 'Signed and encrypted using device'
                    : ', signed and encrypted using device'}
                </Kb.Text>
                <Kb.Text type="BodySmall" style={styles.device} onClick={props.onClickDevice}>
                  {' '}
                  {props.devicename}
                </Kb.Text>
                <Kb.Text type="BodySmall">.</Kb.Text>
              </Kb.Text>
            </Kb.Box>
            {!!props.teamname && (
              <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxRow, alignItems: 'center'}}>
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
              style={{marginTop: Kb.Styles.globalMargins.tiny}}
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
                  color={Kb.Styles.globalColors.black_50}
                  style={{marginRight: Kb.Styles.globalMargins.xtiny}}
                />
              </Kb.Button>
              <Kb.Button
                type="Dim"
                mode="Secondary"
                small={true}
                label="Archive"
                onClick={props.onArchiveGitRepo}
              >
                <Kb.Icon
                  type="iconfont-mailbox"
                  sizeType="Small"
                  color={Kb.Styles.globalColors.black_50}
                  style={{marginRight: Kb.Styles.globalMargins.xtiny}}
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
    </Kb.Box>
    <Kb.Box
      style={{
        ...(props.expanded
          ? {
              backgroundColor: Kb.Styles.globalColors.blueLighter3,
              height: 6,
            }
          : {}),
      }}
    />
  </Kb.Box>
)

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        width: '100%',
      },
      containerMobile: Kb.Styles.platformStyles({
        common: {
          width: '100%',
        },
        isMobile: {
          paddingLeft: Kb.Styles.globalMargins.small,
          paddingRight: Kb.Styles.globalMargins.small,
        },
      }),
      copyTextContainer: {
        flexShrink: 1,
        marginLeft: Kb.Styles.globalMargins.xtiny,
        marginRight: Kb.Styles.globalMargins.tiny,
        maxWidth: 460,
        width: '100%',
      },

      device: {
        ...Kb.Styles.globalStyles.fontSemibold,
        ...Kb.Styles.globalStyles.italic,
        color: Kb.Styles.globalColors.black_50,
      },

      iconCaret: Kb.Styles.platformStyles({
        common: {
          marginBottom: 2,
          marginRight: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          display: 'inline-block',
        },
      }),

      meta: {
        alignSelf: 'center',
        marginLeft: 6,
      },

      rowBottom: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.medium,
        width: '100%',
      },

      rowClick: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingTop: Kb.Styles.globalMargins.tiny,
        width: '100%',
      },

      rowClickExpanded: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        paddingBottom: 0,
        paddingTop: Kb.Styles.globalMargins.tiny,
        width: '100%',
      },

      rowStyle: {
        ...Kb.Styles.globalStyles.flexBoxColumn,
        alignItems: 'flex-start',
        flexShrink: 0,
        minHeight: Kb.Styles.globalMargins.large,
        paddingLeft: 0,
        width: '100%',
      },
      rowTop: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          marginBottom: Kb.Styles.globalMargins.xtiny,
          width: '100%',
        },
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.tiny,
        },
      }),
    }) as const
)
