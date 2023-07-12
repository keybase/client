import * as ConfigGen from '../actions/config-gen'
import * as Constants from '../constants/git'
import * as ConfigConstants from '../constants/config'
import * as Container from '../util/container'
import * as FsConstants from '../constants/fs'
import * as FsTypes from '../constants/types/fs'
import * as Kb from '../common-adapters'
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'
import * as TeamConstants from '../constants/teams'
import * as TrackerConstants from '../constants/tracker2'
import openURL from '../util/open-url'

export const NewContext = React.createContext(new Set())

type OwnProps = {
  id: string
  expanded: boolean
  onShowDelete: (id: string) => void
  onToggleExpand: (id: string) => void
}

const noGit = Constants.makeGitInfo()
const ConnectedRow = (ownProps: OwnProps) => {
  const {id, expanded} = ownProps
  const git = Constants.useGitState(s => s.idToInfo.get(id) || noGit)
  const teamID = TeamConstants.useState(s =>
    git.teamname ? TeamConstants.getTeamID(s, git.teamname) : undefined
  )

  const isNew = React.useContext(NewContext).has(id)

  const you = ConfigConstants.useCurrentUserState(s => s.username)

  const setTeamRepoSettings = Constants.useGitState(s => s.dispatch.setTeamRepoSettings)

  const dispatch = Container.useDispatch()
  const _onBrowseGitRepo = (path: FsTypes.Path) => {
    dispatch(FsConstants.makeActionForOpenPathInFilesTab(path))
  }

  const _onOpenChannelSelection = () => {
    teamID &&
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {repoID: git.repoID, selected: git.channelName || 'general', teamID},
              selected: 'gitSelectChannel',
            },
          ],
        })
      )
  }
  const _setDisableChat = (disabled: boolean, repoID: string, teamname: string) => {
    setTeamRepoSettings('', teamname, repoID, disabled)
  }
  const copyToClipboard = (text: string) => {
    dispatch(ConfigGen.createCopyToClipboard({text}))
  }
  const showUser = TrackerConstants.useState(s => s.dispatch.showUser)
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
    onBrowseGitRepo: () =>
      _onBrowseGitRepo(
        FsTypes.stringToPath(
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
                backgroundColor: Styles.globalColors.white,
              }
            : {}),
        }}
      >
        <Kb.ClickableBox
          onClick={props.onToggleExpand}
          style={props.expanded ? styles.rowClickExpanded : styles.rowClick}
          hoverColor={Styles.isMobile ? undefined : Styles.globalColors.transparent}
          underlayColor={Styles.globalColors.transparent}
        >
          <Kb.Box style={styles.rowTop}>
            <Kb.Icon
              type={props.expanded ? 'iconfont-caret-down' : 'iconfont-caret-right'}
              style={styles.iconCaret}
              sizeType="Tiny"
            />
            <Kb.Avatar
              size={Styles.isMobile ? 48 : 32}
              isTeam={!!props.teamname}
              teamname={props.teamname}
              username={props.teamname ? undefined : props.you}
              style={{marginRight: Styles.globalMargins.tiny}}
            />
            <Kb.Text lineClamp={1} type="BodySemibold" style={{color: Styles.globalColors.black}}>
              {props.teamname ? `${props.teamname}/${props.name}` : props.name}
            </Kb.Text>
            {props.isNew && (
              <Kb.Meta title="new" style={styles.meta} backgroundColor={Styles.globalColors.orange} />
            )}
          </Kb.Box>
        </Kb.ClickableBox>
        {props.expanded && (
          <Kb.Box style={styles.rowBottom}>
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
                  <Kb.ConnectedUsernames
                    type="BodySmallBold"
                    underline={true}
                    colorFollowing={true}
                    usernames={props.lastEditUser}
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
                <Kb.Text type="BodySmall" style={styles.device} onClick={props.onClickDevice}>
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: {
        width: '100%',
      },
      containerMobile: Styles.platformStyles({
        common: {
          width: '100%',
        },
        isMobile: {
          paddingLeft: Styles.globalMargins.small,
          paddingRight: Styles.globalMargins.small,
        },
      }),
      copyTextContainer: {
        flexShrink: 1,
        marginLeft: Styles.globalMargins.xtiny,
        marginRight: Styles.globalMargins.tiny,
        maxWidth: 460,
        width: '100%',
      },

      device: {
        ...Styles.globalStyles.fontSemibold,
        ...Styles.globalStyles.italic,
        color: Styles.globalColors.black_50,
      },

      iconCaret: Styles.platformStyles({
        common: {
          marginBottom: 2,
          marginRight: Styles.globalMargins.tiny,
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
        ...Styles.globalStyles.flexBoxColumn,
        paddingBottom: Styles.globalMargins.tiny,
        paddingLeft: Styles.globalMargins.medium,
        width: '100%',
      },

      rowClick: {
        ...Styles.globalStyles.flexBoxColumn,
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
        width: '100%',
      },

      rowClickExpanded: {
        ...Styles.globalStyles.flexBoxColumn,
        paddingBottom: 0,
        paddingTop: Styles.globalMargins.tiny,
        width: '100%',
      },

      rowStyle: {
        ...Styles.globalStyles.flexBoxColumn,
        alignItems: 'flex-start',
        flexShrink: 0,
        minHeight: Styles.globalMargins.large,
        paddingLeft: 0,
        width: '100%',
      },
      rowTop: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          marginBottom: Styles.globalMargins.xtiny,
          width: '100%',
        },
        isElectron: {
          paddingLeft: Styles.globalMargins.tiny,
        },
      }),
    } as const)
)
