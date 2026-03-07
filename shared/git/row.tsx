import * as C from '@/constants'
import * as Git from '@/stores/git'
import * as Teams from '@/stores/teams'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import openURL from '@/util/open-url'
import {useTrackerState} from '@/stores/tracker'
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
function ConnectedRow(ownProps: OwnProps) {
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

  const onArchiveGitRepo = () => {
    gitURL &&
      navigateAppend({
        name: 'archiveModal',
        params: {gitURL, type: 'git' as const},
      })
  }

  const _onOpenChannelSelection = () => {
    teamID &&
      navigateAppend({
        name: 'gitSelectChannel',
        params: {repoID, selected: channelName || 'general', teamID},
      })
  }

  const onToggleChatEnabled = () => {
    teamname && setTeamRepoSettings('', teamname, repoID, !chatDisabled)
  }

  const showUser = useTrackerState(s => s.dispatch.showUser)
  const openUserTracker = (username: string) => {
    showUser(username, true)
  }

  const onBrowseGitRepo = () =>
    _onBrowseGitRepo(
      T.FS.stringToPath(
        gitURL.replace(/keybase:\/\/((private|public|team)\/[^/]*)\/(.*)/, '/keybase/$1/.kbfs_autogit/$3')
      )
    )

  const onShowDelete = () => onShowDelete_(id)
  const onToggleExpand = () => onToggleExpand_(id)

  const onClickDevice = () => {
    lastEditUser && openURL(`https://keybase.io/${lastEditUser}/devices`)
  }

  const onChannelClick = (e: React.BaseSyntheticEvent) => {
    if (!chatDisabled) {
      e.preventDefault()
      _onOpenChannelSelection()
    }
  }

  const canEdit = canDelete && !!teamname
  const url = gitURL
  // TODO use ListItem
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.containerMobile}>
        <Kb.Box2
          direction="vertical"
          fullWidth={true}
          alignItems="flex-start"
          style={Kb.Styles.collapseStyles([
            styles.rowStyle,
            expanded && {backgroundColor: Kb.Styles.globalColors.white},
          ])}
        >
          <Kb.ClickableBox
            onClick={onToggleExpand}
            style={expanded ? styles.rowClickExpanded : styles.rowClick}
            hoverColor={Kb.Styles.isMobile ? undefined : Kb.Styles.globalColors.transparent}
            underlayColor={Kb.Styles.globalColors.transparent}
          >
            <Kb.Box2 direction="horizontal" fullWidth={true} alignItems="center" style={styles.rowTop}>
              <Kb.Icon2
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
            </Kb.Box2>
          </Kb.ClickableBox>
          {expanded && (
            <Kb.Box2 direction="vertical" fullWidth={true} style={styles.rowBottom}>
              <Kb.Box2
                direction="horizontal"
                fullWidth={true}
                alignItems="center"
          relative={true}
                style={{
                  maxWidth: '100%',
                }}
              >
                <Kb.Text type="Body">Clone:</Kb.Text>
                <Kb.Box2 direction="horizontal" style={styles.copyTextContainer}>
                  <Kb.CopyText text={url} containerStyle={{width: '100%'}} />
                </Kb.Box2>
              </Kb.Box2>
              <Kb.Box2
                direction="horizontal"
                fullWidth={true}
                alignItems="center"
                alignSelf="flex-start"
                style={{
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
                  <Kb.Box2 direction="vertical" style={{marginLeft: 2}}>
                    <Kb.ConnectedUsernames
                      type="BodySmallBold"
                      underline={true}
                      colorFollowing={true}
                      usernames={lastEditUser}
                      onUsernameClicked={() => openUserTracker(lastEditUser)}
                    />
                  </Kb.Box2>
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
              </Kb.Box2>
              {!!teamname && (
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
                  <Kb.Icon2
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
                  <Kb.Icon2
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
            </Kb.Box2>
          )}
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={expanded ? styles.expandedSpacer : undefined}
      />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      containerMobile: Kb.Styles.platformStyles({
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
      expandedSpacer: {
        backgroundColor: Kb.Styles.globalColors.blueLighter3,
        height: 6,
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
        paddingBottom: Kb.Styles.globalMargins.tiny,
        paddingLeft: Kb.Styles.globalMargins.medium,
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
        flexShrink: 0,
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
