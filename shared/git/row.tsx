import * as C from '@/constants'
import * as Git from '@/stores/git'
import * as Teams from '@/stores/teams'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import openURL from '@/util/open-url'
import {useTrackerState} from '@/stores/tracker2'
import * as FS from '@/stores/fs'
import {useCurrentUserState} from '@/stores/current-user'

export const NewContext = React.createContext<ReadonlySet<string>>(new Set())

type OwnProps = {
  id: string
  expanded: boolean
  onShowDelete: (id: string) => void
  onToggleExpand: (id: string) => void
}

const channelNameToString = (channelName?: string) => (channelName ? `#${channelName}` : '#general')

const noGit = Git.makeGitInfo()
const ConnectedRow = React.memo(function ConnectedRow(ownProps: OwnProps) {
  const {id, expanded, onShowDelete: onShowDelete_, onToggleExpand: onToggleExpand_} = ownProps
  const git = Git.useGitState(s => s.idToInfo.get(id) || noGit)
  const teamID = Teams.useTeamsState(s => (git.teamname ? Teams.getTeamID(s, git.teamname) : undefined))
  const isNew = React.useContext(NewContext).has(id)
  const you = useCurrentUserState(s => s.username)
  const setTeamRepoSettings = Git.useGitState(s => s.dispatch.setTeamRepoSettings)
  const _onBrowseGitRepo = FS.navToPath
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)

  const {url: gitURL, repoID, channelName, teamname, chatDisabled} = git
  const {canDelete, devicename, lastEditTime, lastEditUser, name} = git

  const onArchiveGitRepo = React.useCallback(() => {
    gitURL &&
      navigateAppend({
        props: {gitURL, type: 'git' as const},
        selected: 'archiveModal',
      })
  }, [navigateAppend, gitURL])

  const _onOpenChannelSelection = React.useCallback(() => {
    teamID &&
      navigateAppend({
        props: {repoID, selected: channelName || 'general', teamID},
        selected: 'gitSelectChannel',
      })
  }, [navigateAppend, repoID, channelName, teamID])

  const onToggleChatEnabled = React.useCallback(() => {
    teamname && setTeamRepoSettings('', teamname, repoID, !chatDisabled)
  }, [teamname, chatDisabled, repoID, setTeamRepoSettings])

  const showUser = useTrackerState(s => s.dispatch.showUser)
  const openUserTracker = React.useCallback(
    (username: string) => {
      showUser(username, true)
    },
    [showUser]
  )

  const onBrowseGitRepo = React.useCallback(
    () =>
      _onBrowseGitRepo(
        T.FS.stringToPath(
          gitURL.replace(/keybase:\/\/((private|public|team)\/[^/]*)\/(.*)/, '/keybase/$1/.kbfs_autogit/$3')
        )
      ),
    [_onBrowseGitRepo, gitURL]
  )

  const onShowDelete = React.useCallback(() => onShowDelete_(id), [onShowDelete_, id])
  const onToggleExpand = React.useCallback(() => onToggleExpand_(id), [onToggleExpand_, id])

  const onClickDevice = React.useCallback(() => {
    lastEditUser && openURL(`https://keybase.io/${lastEditUser}/devices`)
  }, [lastEditUser])

  const onChannelClick = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      if (!chatDisabled) {
        e.preventDefault()
        _onOpenChannelSelection()
      }
    },
    [_onOpenChannelSelection, chatDisabled]
  )

  const canEdit = canDelete && !!teamname
  const url = gitURL
  // TODO use ListItem2
  return (
    <Kb.Box style={styles.container}>
      <Kb.Box style={styles.containerMobile}>
        <Kb.Box
          style={{
            ...styles.rowStyle,
            ...(expanded
              ? {
                  backgroundColor: Kb.Styles.globalColors.white,
                }
              : {}),
          }}
        >
          <Kb.ClickableBox
            onClick={onToggleExpand}
            style={expanded ? styles.rowClickExpanded : styles.rowClick}
            hoverColor={Kb.Styles.isMobile ? undefined : Kb.Styles.globalColors.transparent}
            underlayColor={Kb.Styles.globalColors.transparent}
          >
            <Kb.Box style={styles.rowTop}>
              <Kb.Icon
                type={expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
                style={styles.iconCaret}
                sizeType="Tiny"
              />
              <Kb.Avatar
                size={Kb.Styles.isMobile ? 48 : 32}
                isTeam={!!teamname}
                teamname={teamname}
                username={teamname ? undefined : you}
                style={styles.iconTiny}
              />
              <Kb.Text lineClamp={1} type="BodySemibold" style={{color: Kb.Styles.globalColors.black}}>
                {teamname ? `${teamname}/${name}` : name}
              </Kb.Text>
              {isNew && (
                <Kb.Meta title="new" style={styles.meta} backgroundColor={Kb.Styles.globalColors.orange} />
              )}
            </Kb.Box>
          </Kb.ClickableBox>
          {expanded && (
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
                  <Kb.CopyText text={url} containerStyle={{width: '100%'}} />
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
                  {`Last push ${lastEditTime}${!!teamname && !!lastEditUser ? ' by ' : ''}`}
                </Kb.Text>
                {!!teamname && !!lastEditUser && (
                  <Kb.Avatar
                    username={lastEditUser}
                    size={16}
                    style={{marginLeft: Kb.Styles.isMobile ? 0 : 4}}
                  />
                )}
                {!!teamname && !!lastEditUser && (
                  <Kb.Box style={{marginLeft: 2}}>
                    <Kb.ConnectedUsernames
                      type="BodySmallBold"
                      underline={true}
                      colorFollowing={true}
                      usernames={lastEditUser}
                      onUsernameClicked={() => openUserTracker(lastEditUser)}
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
                  <Kb.Text type="BodySmall" style={styles.device} onClick={onClickDevice}>
                    {' '}
                    {devicename}
                  </Kb.Text>
                  <Kb.Text type="BodySmall">.</Kb.Text>
                </Kb.Text>
              </Kb.Box>
              {!!teamname && (
                <Kb.Box style={{...Kb.Styles.globalStyles.flexBoxRow, alignItems: 'center'}}>
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
            </Kb.Box>
          )}
        </Kb.Box>
      </Kb.Box>
      <Kb.Box
        style={{
          ...(expanded
            ? {
                backgroundColor: Kb.Styles.globalColors.blueLighter3,
                height: 6,
              }
            : {}),
        }}
      />
    </Kb.Box>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {width: '100%'},
      containerMobile: Kb.Styles.platformStyles({
        common: {width: '100%'},
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
        isElectron: {display: 'inline-block'},
      }),
      iconTiny: {marginRight: Kb.Styles.globalMargins.tiny},
      iconXtiny: {marginRight: Kb.Styles.globalMargins.xtiny},
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
        isElectron: {paddingLeft: Kb.Styles.globalMargins.tiny},
      }),
    }) as const
)

export default ConnectedRow
