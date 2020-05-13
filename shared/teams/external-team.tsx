import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as Constants from '../constants/teams'
import * as RPCGen from '../constants/types/rpc-gen'
import * as Chat2Gen from '../actions/chat2-gen'
import * as ProfileGen from '../actions/profile-gen'
import {useTeamLinkPopup} from './common'
import {pluralize} from '../util/string'
import {memoize} from '../util/memoize'
import capitalize from 'lodash/capitalize'
import {headerDefaultStyle} from '../router-v2/router'

type Props = Container.RouteProps<{teamname: string}>

const ExternalTeam = (props: Props) => {
  const teamname = Container.getRouteProps(props, 'teamname', '')

  const getTeamInfo = Container.useRPC(RPCGen.teamsGetUntrustedTeamInfoRpcPromise)
  const [teamInfo, setTeamInfo] = React.useState<RPCGen.UntrustedTeamInfo | null>(null)
  const [waiting, setWaiting] = React.useState(false)

  React.useEffect(() => {
    setWaiting(true)
    getTeamInfo(
      [{teamName: {parts: teamname.split('.')}}], // TODO this should just take a string
      result => {
        // Note: set all state variables in both of these cases even if they're
        // not changing from defaults. The user might be stacking these pages on
        // top of one another, in which case react will preserve state from
        // previously rendered teams.
        setWaiting(false)
        setTeamInfo(result)
      },
      _ => {
        setWaiting(false)
        setTeamInfo(null)
      }
    )
  }, [getTeamInfo, teamname])

  if (teamInfo) {
    return (
      <Kb.Box2 direction="vertical" gap="small" fullWidth={true} fullHeight={true}>
        <ExternalTeamInfo info={teamInfo} />
      </Kb.Box2>
    )
  }

  return (
    <Kb.Box2 direction="vertical" gap="small" style={styles.container} fullWidth={true}>
      {waiting ? (
        <Kb.Box2
          direction="horizontal"
          gap={Styles.isMobile ? 'small' : 'tiny'}
          fullWidth={true}
          alignItems="center"
        >
          <Kb.ProgressIndicator />
          <Kb.Text type="BodySmall">Loading team...</Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Text type="Body" style={styles.error}>
          This team does not exist or it has no public information available.
        </Kb.Text>
      )}
    </Kb.Box2>
  )
}
ExternalTeam.navigationOptions = {
  header: undefined,
  headerBottomStyle: {height: undefined},
  headerHideBorder: true,
  headerStyle: {...headerDefaultStyle, borderBottomWidth: 0},
  title: ' ', // hack: trick router shim so it doesn't add a safe area around us
}

type ExternalTeamProps = {
  info: RPCGen.UntrustedTeamInfo
}

const orderMembers = memoize((members?: Array<RPCGen.TeamMemberRole>) =>
  (members || []).sort((memberA, memberB) =>
    memberB.role === memberA.role
      ? memberA.username.localeCompare(memberB.username)
      : memberB.role - memberA.role
  )
)
const ExternalTeamInfo = ({info}: ExternalTeamProps) => {
  const members = orderMembers(info.publicMembers ?? undefined)
  const sections = [
    {
      data: ['header'],
      key: 'headerSection',
      renderItem: () => <Header info={info} />,
    },
    {
      data: members.length ? members : ['empty'],
      key: 'membersSection',
      renderItem: ({item, index}) => {
        return item === 'empty' ? (
          <Kb.Box2
            direction="vertical"
            fullWidth={true}
            gap="large"
            gapStart={true}
            gapEnd={true}
            centerChildren={true}
          >
            <Kb.Text type="BodySmall">This team has no public members.</Kb.Text>
          </Kb.Box2>
        ) : (
          <Member member={item} firstItem={index === 0} />
        )
      },
    },
  ]
  const renderSectionHeader = ({section}) => {
    if (section.key === 'membersSection') {
      return (
        <Kb.Tabs
          tabs={[{title: 'Public members'}]}
          selectedTab="Public members"
          style={styles.tabs}
          onSelect={() => {}}
        />
      )
    }
    return null
  }
  return (
    <Kb.SectionList
      sections={sections}
      contentContainerStyle={styles.contentContainer}
      renderSectionHeader={renderSectionHeader}
    />
  )
}

const Header = ({info}: ExternalTeamProps) => {
  const dispatch = Container.useDispatch()
  const nav = Container.useSafeNavigation()
  const teamname = info.name.parts?.join('.')
  const onJoin = () =>
    dispatch(
      nav.safeNavigateAppendPayload({
        path: [{props: {initialTeamname: teamname}, selected: 'teamJoinTeamDialog'}],
      })
    )

  const {popupAnchor, setShowingPopup, popup} = useTeamLinkPopup(teamname || '')

  const metaInfo = (
    <Kb.Box2 direction="vertical" alignSelf="stretch" gap={Styles.isMobile ? 'small' : 'tiny'}>
      <Kb.Box2 direction="vertical" alignSelf="stretch" gap={Styles.isMobile ? 'xtiny' : 'xxtiny'}>
        {!!info.description && <Kb.Text type="Body">{info.description}</Kb.Text>}
        <Kb.Text type="BodySmall">
          {info.numMembers.toLocaleString()} {pluralize('member', info.numMembers)}
        </Kb.Text>
        {/* TODO add activity */}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" alignSelf="stretch" gap="tiny" fullWidth={true}>
        <Kb.Button onClick={onJoin} type="Success" label="Join team" small={true} />
        <Kb.Button
          mode="Secondary"
          label="Share"
          small={true}
          ref={popupAnchor}
          onClick={() => setShowingPopup(true)}
        />
        {popup}
      </Kb.Box2>
    </Kb.Box2>
  )
  const openMeta = <Kb.Meta style={styles.meta} title="OPEN" backgroundColor={Styles.globalColors.green} />
  return (
    <Kb.Box2 direction="vertical" gap="small" fullWidth={true} style={styles.headerContainer}>
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true} alignItems="flex-start">
        <Kb.Avatar size={96} teamname={teamname} />
        <Kb.Box2 direction="vertical" gap="xxtiny" alignSelf="flex-start">
          <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
            <Kb.Text type="Header">{teamname}</Kb.Text>
            {!Styles.isMobile && openMeta}
          </Kb.Box2>
          {Styles.isMobile && openMeta}
          {!Styles.isMobile && metaInfo}
        </Kb.Box2>
      </Kb.Box2>
      {Styles.isMobile && metaInfo}
    </Kb.Box2>
  )
}

const Member = ({member, firstItem}: {member: RPCGen.TeamMemberRole; firstItem: boolean}) => {
  const dispatch = Container.useDispatch()
  const onChat = () =>
    dispatch(Chat2Gen.createPreviewConversation({participants: [member.username], reason: 'teamMember'}))
  const roleString = Constants.teamRoleByEnum[member.role]
  return (
    <Kb.ListItem2
      firstItem={firstItem}
      type="Large"
      icon={<Kb.Avatar size={32} username={member.username} />}
      onClick={() => dispatch(ProfileGen.createShowUserProfile({username: member.username}))}
      body={
        <Kb.Box2 direction="vertical" alignItems="flex-start" style={styles.memberBody}>
          <Kb.ConnectedUsernames type="BodyBold" usernames={member.username} colorFollowing={true} />
          <Kb.Box2 direction="horizontal" alignItems="center" alignSelf="flex-start">
            {!!member.fullName && (
              <Kb.Text type="BodySmall" style={{flexShrink: 1}} lineClamp={1}>
                {member.fullName.trim()}
              </Kb.Text>
            )}
            {!!member.fullName && (
              <Kb.Text type="BodySmall" style={styles.middot}>
                •
              </Kb.Text>
            )}
            {[RPCGen.TeamRole.admin, RPCGen.TeamRole.owner].includes(member.role) && (
              <Kb.Icon
                type={`iconfont-crown-${roleString}` as Kb.IconType}
                sizeType="Small"
                style={styles.crownIcon}
              />
            )}
            <Kb.Text type="BodySmall">{capitalize(roleString)}</Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
      }
      action={<Kb.Button type="Dim" mode="Secondary" onClick={onChat} icon="iconfont-chat" small={true} />}
      onlyShowActionOnHover="fade"
    />
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    padding: Styles.globalMargins.small,
  },
  contentContainer: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.small,
    },
    isElectron: {
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  crownIcon: Styles.platformStyles({
    common: {marginRight: Styles.globalMargins.xtiny},
  }),
  error: {color: Styles.globalColors.redDark},
  headerContainer: {
    ...Styles.padding(0, Styles.globalMargins.small),
  },
  memberBody: {
    flex: 1,
    paddingRight: Styles.globalMargins.tiny,
  },
  meta: Styles.platformStyles({
    isElectron: {
      alignSelf: 'center',
    },
  }),
  middot: {
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: Styles.globalMargins.xtiny,
  },
  tabs: {
    backgroundColor: Styles.globalColors.white,
    width: '100%',
  },
}))

export default ExternalTeam
