import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as Container from '@/util/container'
import * as T from '@/constants/types'
import {useTeamLinkPopup} from './common'
import {pluralize} from '@/util/string'
import capitalize from 'lodash/capitalize'

type Props = {teamname: string}

const ExternalTeam = (props: Props) => {
  const teamname = props.teamname

  const getTeamInfo = C.useRPC(T.RPCGen.teamsGetUntrustedTeamInfoRpcPromise)
  const [teamInfo, setTeamInfo] = React.useState<T.RPCGen.UntrustedTeamInfo | undefined>()
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
        setTeamInfo(undefined)
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
          gap={Kb.Styles.isMobile ? 'small' : 'tiny'}
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

type ExternalTeamProps = {
  info: T.RPCGen.UntrustedTeamInfo
}

const orderMembers = (members?: ReadonlyArray<T.RPCGen.TeamMemberRole>) =>
  [...(members || [])].sort((memberA, memberB) =>
    memberB.role === memberA.role
      ? memberA.username.localeCompare(memberB.username)
      : memberB.role - memberA.role
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
      renderItem: ({item, index}: {item: T.RPCChat.Keybase1.TeamMemberRole | 'empty'; index: number}) => {
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
  ] as const
  const renderSectionHeader = ({section}: {section: (typeof sections)[number]}) => {
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
  const nav = Container.useSafeNavigation()
  const teamname = info.name.parts?.join('.')
  const onJoin = () =>
    nav.safeNavigateAppend({props: {initialTeamname: teamname}, selected: 'teamJoinTeamDialog'})
  const {popupAnchor, showPopup, popup} = useTeamLinkPopup(teamname || '')

  const metaInfo = (
    <Kb.Box2 direction="vertical" alignSelf="stretch" gap={Kb.Styles.isMobile ? 'small' : 'tiny'}>
      <Kb.Box2 direction="vertical" alignSelf="stretch" gap={Kb.Styles.isMobile ? 'xtiny' : 'xxtiny'}>
        {!!info.description && <Kb.Text type="Body">{info.description}</Kb.Text>}
        <Kb.Text type="BodySmall">
          {info.numMembers.toLocaleString()} {pluralize('member', info.numMembers)}
        </Kb.Text>
        {/* TODO add activity */}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" alignSelf="stretch" gap="tiny" fullWidth={true}>
        <Kb.Button onClick={onJoin} type="Success" label="Join team" small={true} />
        <Kb.Button mode="Secondary" label="Share" small={true} ref={popupAnchor} onClick={showPopup} />
        {popup}
      </Kb.Box2>
    </Kb.Box2>
  )
  const openMeta = <Kb.Meta style={styles.meta} title="OPEN" backgroundColor={Kb.Styles.globalColors.green} />
  return (
    <Kb.Box2 direction="vertical" gap="small" fullWidth={true} style={styles.headerContainer}>
      <Kb.Box2 direction="horizontal" gap="small" fullWidth={true} alignItems="flex-start">
        <Kb.Avatar size={96} teamname={teamname} />
        <Kb.Box2 direction="vertical" gap="xxtiny" alignSelf="flex-start">
          <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
            <Kb.Text type="Header">{teamname}</Kb.Text>
            {!Kb.Styles.isMobile && openMeta}
          </Kb.Box2>
          {Kb.Styles.isMobile && openMeta}
          {!Kb.Styles.isMobile && metaInfo}
        </Kb.Box2>
      </Kb.Box2>
      {Kb.Styles.isMobile && metaInfo}
    </Kb.Box2>
  )
}

const Member = ({member, firstItem}: {member: T.RPCGen.TeamMemberRole; firstItem: boolean}) => {
  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const onChat = () => previewConversation({participants: [member.username], reason: 'teamMember'})
  const roleString = C.Teams.teamRoleByEnum[member.role]
  const showUserProfile = C.useProfileState(s => s.dispatch.showUserProfile)
  return (
    <Kb.ListItem2
      firstItem={firstItem}
      type="Large"
      icon={<Kb.Avatar size={32} username={member.username} />}
      onClick={() => showUserProfile(member.username)}
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
            {[T.RPCGen.TeamRole.admin, T.RPCGen.TeamRole.owner].includes(member.role) && (
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    padding: Kb.Styles.globalMargins.small,
  },
  contentContainer: Kb.Styles.platformStyles({
    common: {
      paddingBottom: Kb.Styles.globalMargins.small,
    },
    isElectron: {
      paddingTop: Kb.Styles.globalMargins.tiny,
    },
  }),
  crownIcon: Kb.Styles.platformStyles({
    common: {marginRight: Kb.Styles.globalMargins.xtiny},
  }),
  error: {color: Kb.Styles.globalColors.redDark},
  headerContainer: {
    ...Kb.Styles.padding(0, Kb.Styles.globalMargins.small),
  },
  memberBody: {
    flex: 1,
    paddingRight: Kb.Styles.globalMargins.tiny,
  },
  meta: Kb.Styles.platformStyles({
    isElectron: {
      alignSelf: 'center',
    },
  }),
  middot: {
    marginLeft: Kb.Styles.globalMargins.xtiny,
    marginRight: Kb.Styles.globalMargins.xtiny,
  },
  tabs: {
    backgroundColor: Kb.Styles.globalColors.white,
    width: '100%',
  },
}))

export default ExternalTeam
