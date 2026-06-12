import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {openURL} from '@/util/misc'
import * as FS from '@/constants/fs'
import {useCurrentUserState} from '@/stores/current-user'
import {navToProfile} from '@/constants/router'
import {useTeamsListNameToIDMap} from '@/teams/use-teams-list'

export const NewContext = React.createContext<ReadonlySet<string>>(new Set())

type OwnProps = {
  expanded: boolean
  git: T.Git.GitInfo
  onShowDelete: (git: T.Git.GitInfo) => void
  onToggleExpand: (id: string) => void
  reload: () => void
  setError: (error?: Error) => void
}

const channelNameToString = (channelName?: string) => (channelName ? `#${channelName}` : '#general')

const CloneRow = (p: {url: string}) => (
  <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" relative={true} style={styles.cloneRow}>
    <Kb.Text type="Body">Clone:</Kb.Text>
    <Kb.CopyText text={p.url} containerStyle={styles.copyTextContainer} />
  </Kb.Box2>
)

const LastPushRow = (p: {
  devicename: string
  lastEditTime: string
  lastEditUser: string
  teamname?: string
  onClickDevice: () => void
}) => {
  const {devicename, lastEditTime, lastEditUser, teamname, onClickDevice} = p
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      alignItems="center"
      alignSelf="flex-start"
      style={styles.lastPushRow}
    >
      <Kb.Text type="BodySmall">
        {`Last push ${lastEditTime}${!!teamname && !!lastEditUser ? ' by ' : ''}`}
      </Kb.Text>
      {!!teamname && !!lastEditUser && (
        <Kb.Avatar
          username={lastEditUser}
          size={16}
          style={styles.lastEditAvatar}
        />
      )}
      {!!teamname && !!lastEditUser && (
        <Kb.ConnectedUsernames
          type="BodySmallBold"
          underline={true}
          colorFollowing={true}
          usernames={lastEditUser}
          onUsernameClicked={() => navToProfile(lastEditUser)}
          containerStyle={styles.usernameContainer}
        />
      )}
      {isMobile && <Kb.Text type="BodySmall">. </Kb.Text>}
      <Kb.Text type="BodySmall">
        <Kb.Text type="BodySmall">
          {isMobile
            ? 'Signed and encrypted using device'
            : ', signed and encrypted using device'}
        </Kb.Text>
        <Kb.Text type="BodySmall" style={styles.device} onClick={onClickDevice}>
          {' '}
          {devicename}
        </Kb.Text>
        <Kb.Text type="BodySmall">.</Kb.Text>
      </Kb.Text>
    </Kb.Box2>
  )
}

const ChatRow = (p: {
  canEdit: boolean
  channelName?: string
  chatDisabled: boolean
  teamname: string
  onChannelClick: (e: React.BaseSyntheticEvent) => void
  onToggleChatEnabled: () => void
}) => {
  const {canEdit, channelName, chatDisabled, teamname, onChannelClick, onToggleChatEnabled} = p
  return (
    <Kb.Box2 direction="horizontal" alignItems="center">
      {canEdit && (
        <Kb.Checkbox
          checked={!chatDisabled}
          onCheck={onToggleChatEnabled}
          label=""
          labelComponent={
            <Kb.Text type="BodySmall">
              Announce pushes in{' '}
              <Kb.Text
                type={chatDisabled ? 'BodySmall' : 'BodySmallPrimaryLink'}
                onClick={onChannelClick}
              >
                {channelNameToString(channelName)}
              </Kb.Text>
            </Kb.Text>
          }
        />
      )}
      {!canEdit && (
        <Kb.Text type="BodySmall">
          {chatDisabled
            ? 'Pushes are not announced'
            : `Pushes are announced in ${teamname}${channelNameToString(channelName)}`}
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}

const ActionsRow = (p: {
  canDelete: boolean
  onArchiveGitRepo: () => void
  onBrowseGitRepo: () => void
  onShowDelete: () => void
}) => {
  const {canDelete, onArchiveGitRepo, onBrowseGitRepo, onShowDelete} = p
  return (
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.actionRow} gap="tiny">
      <Kb.Button
        type="Dim"
        mode="Secondary"
        small={true}
        label="View files"
        onClick={onBrowseGitRepo}
      >
        <Kb.Icon
          type="iconfont-file"
          sizeType="Small"
          color={Kb.Styles.globalColors.black_50}
          style={styles.iconXtiny}
        />
      </Kb.Button>
      <Kb.Button
        type="Dim"
        mode="Secondary"
        small={true}
        label="Archive"
        onClick={onArchiveGitRepo}
      >
        <Kb.Icon
          type="iconfont-mailbox"
          sizeType="Small"
          color={Kb.Styles.globalColors.black_50}
          style={styles.iconXtiny}
        />
      </Kb.Button>
      {canDelete && (
        <Kb.Button
          type="Danger"
          mode="Secondary"
          small={true}
          label="Delete repo"
          onClick={onShowDelete}
        />
      )}
    </Kb.Box2>
  )
}

function ConnectedRow(ownProps: OwnProps) {
  const {expanded, git, onShowDelete: onShowDelete_, onToggleExpand: onToggleExpand_, reload, setError} = ownProps
  const {id} = git
  const teamNameToID = useTeamsListNameToIDMap()
  const teamID = git.teamname ? teamNameToID.get(git.teamname) : undefined
  const isNew = React.useContext(NewContext).has(id)
  const you = useCurrentUserState(s => s.username)
  const setTeamRepoSettings = C.useRPC(T.RPCGen.gitSetTeamRepoSettingsRpcPromise)
  const _onBrowseGitRepo = FS.navToPath
  const navigateAppend = C.Router2.navigateAppend

  const {url: gitURL, repoID, channelName, teamname, chatDisabled} = git
  const {canDelete, devicename, lastEditTime, lastEditUser, name} = git

  const onArchiveGitRepo = () => {
    if (gitURL) {
      navigateAppend({
        name: 'archiveModal',
        params: {gitURL, type: 'git' as const},
      })
    }
  }

  const _onOpenChannelSelection = () => {
    if (teamID) {
      navigateAppend({
        name: 'gitSelectChannel',
        params: {repoID, selected: channelName || 'general', teamID, teamname: teamname ?? ''},
      })
    }
  }

  const onToggleChatEnabled = () => {
    if (!teamname) {
      return
    }
    setTeamRepoSettings(
      [
        {
          channelName: '',
          chatDisabled: !chatDisabled,
          folder: {
            created: false,
            folderType: T.RPCGen.FolderType.team,
            name: teamname,
          },
          repoID,
        },
      ],
      () => {
        setError(undefined)
        reload()
      },
      err => {
        setError(err)
      }
    )
  }

  const onBrowseGitRepo = () =>
    _onBrowseGitRepo(
      T.FS.stringToPath(
        gitURL.replace(/keybase:\/\/((private|public|team)\/[^/]*)\/(.*)/, '/keybase/$1/.kbfs_autogit/$3')
      )
    )

  const onShowDelete = () => onShowDelete_(git)
  const onToggleExpand = () => onToggleExpand_(id)

  const onClickDevice = () => {
    if (lastEditUser) {
      void openURL(`https://keybase.io/${lastEditUser}/devices`)
    }
  }

  const onChannelClick = (e: React.BaseSyntheticEvent) => {
    if (!chatDisabled) {
      e.preventDefault()
      _onOpenChannelSelection()
    }
  }

  const canEdit = canDelete && !!teamname
  return (
    <>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.containerMobile} testID={TestIDs.GIT_REPO_ROW}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          alignItems="flex-start"
          noShrink={true}
          style={Kb.Styles.collapseStyles([
            styles.rowStyle,
            expanded && {backgroundColor: Kb.Styles.globalColors.white},
          ])}
        >
          <Kb.ClickableBox
            onClick={onToggleExpand}
            direction="horizontal"
            fullWidth={true}
            alignItems="center"
            style={Kb.Styles.collapseStyles([
              expanded ? styles.rowClickExpanded : styles.rowClick,
              styles.rowTop,
            ])}
          >
            <Kb.Icon
              type={expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
              style={styles.iconCaret}
              sizeType="Tiny"
            />
            <Kb.Avatar
              size={isMobile ? 48 : 32}
              isTeam={!!teamname}
              teamname={teamname}
              username={teamname ? undefined : you}
              style={styles.iconTiny}
            />
            <Kb.Text lineClamp={1} type="BodySemibold" style={styles.repoName}>
              {teamname ? `${teamname}/${name}` : name}
            </Kb.Text>
            {isNew && (
              <Kb.Meta title="new" style={styles.meta} backgroundColor={Kb.Styles.globalColors.orange} />
            )}
          </Kb.ClickableBox>
          {expanded && (
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rowBottom}>
              <CloneRow url={gitURL} />
              <LastPushRow
                devicename={devicename}
                lastEditTime={lastEditTime}
                lastEditUser={lastEditUser}
                teamname={teamname}
                onClickDevice={onClickDevice}
              />
              {!!teamname && (
                <ChatRow
                  canEdit={canEdit}
                  channelName={channelName}
                  chatDisabled={chatDisabled}
                  teamname={teamname}
                  onChannelClick={onChannelClick}
                  onToggleChatEnabled={onToggleChatEnabled}
                />
              )}
              <ActionsRow
                canDelete={canDelete}
                onArchiveGitRepo={onArchiveGitRepo}
                onBrowseGitRepo={onBrowseGitRepo}
                onShowDelete={onShowDelete}
              />
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={expanded ? styles.expandedSpacer : undefined}
      />
    </>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      actionRow: {marginTop: Kb.Styles.globalMargins.tiny},
      cloneRow: {maxWidth: '100%'},
      containerMobile: Kb.Styles.platformStyles({
        isMobile: {
          ...Kb.Styles.paddingH(Kb.Styles.globalMargins.small),
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
      expandedSpacer: {
        backgroundColor: Kb.Styles.globalColors.blueLighter3,
        height: 6,
      },
      lastEditAvatar: Kb.Styles.platformStyles({
        isElectron: {marginLeft: 4},
      }),
      lastPushRow: {
        flexWrap: 'wrap',
        marginTop: Kb.Styles.globalMargins.tiny,
      },
      repoName: {color: Kb.Styles.globalColors.black},
      iconCaret: Kb.Styles.platformStyles({
        common: {
          marginBottom: 2,
          marginRight: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {display: 'inline-block'},
      }),
      iconTiny: {marginRight: Kb.Styles.globalMargins.tiny},
      iconXtiny: {marginRight: Kb.Styles.globalMargins.xtiny},
      meta: {
        alignSelf: 'center',
        marginLeft: 6,
      },
      rowBottom: {
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.medium,
      },
      rowClick: {
        ...Kb.Styles.paddingV(Kb.Styles.globalMargins.tiny),
      },
      rowClickExpanded: {
        paddingBottom: 0,
        paddingTop: Kb.Styles.globalMargins.tiny,
      },

      usernameContainer: {marginLeft: 2},
      rowStyle: {
        minHeight: Kb.Styles.globalMargins.large,
        paddingLeft: 0,
      },
      rowTop: Kb.Styles.platformStyles({
        common: {
          marginBottom: Kb.Styles.globalMargins.xtiny,
        },
        isElectron: {paddingLeft: Kb.Styles.globalMargins.tiny},
      }),
    }) as const
)

export default ConnectedRow
