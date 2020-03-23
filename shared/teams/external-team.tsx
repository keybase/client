import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as Constants from '../constants/teams'
import * as RPCGen from '../constants/types/rpc-gen'
import {pluralize} from '../util/string'
import {memoize} from '../util/memoize'
import capitalize from 'lodash/capitalize'

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
    <Kb.Box2 direction="vertical" gap="small" style={styles.container}>
      {waiting ? (
        <Kb.ProgressIndicator />
      ) : (
        <Kb.Text type="BodySmallError">There is no public information available for this team.</Kb.Text>
      )}
    </Kb.Box2>
  )
}
ExternalTeam.navigationOptions = {
  header: undefined,
  headerBottomStyle: {height: undefined},
  headerHideBorder: true,
  headerStyle: {borderBottomWidth: 0},
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
        const roleString = Constants.teamRoleByEnum[item.role]
        return item === 'empty' ? (
          <Kb.Text type="HeaderBig">Ain't no public members! At all!</Kb.Text>
        ) : (
          <Kb.ListItem2
            firstItem={index === 0}
            type="Large"
            icon={<Kb.Avatar size={32} username={item.username} />}
            body={
              <Kb.Box2 direction="vertical" alignItems="flex-start">
                <Kb.ConnectedUsernames type="BodySemibold" usernames={item.username} colorFollowing={true} />
                <Kb.Box2 direction="horizontal" alignItems="center" alignSelf="flex-start">
                  {!!item.fullName && <Kb.Text type="BodySmall">{item.fullName.trim()} • </Kb.Text>}
                  {[RPCGen.TeamRole.admin, RPCGen.TeamRole.owner].includes(item.role) && (
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
          />
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
  const teamname = info.name.parts?.join('.')
  const metaInfo = (
    <Kb.Box2 direction="vertical" gap={Styles.isMobile ? 'small' : 'tiny'}>
      <Kb.Box2 direction="vertical" gap={Styles.isMobile ? 'xtiny' : 'xxtiny'}>
        <Kb.Text type="Body">{info.description}</Kb.Text>
        <Kb.Text type="BodySmall">
          {info.numMembers.toLocaleString()} {pluralize('member', info.numMembers)}
        </Kb.Text>
        {/* TODO add activity */}
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true}>
        <Kb.Button type="Success" label="Join team" small={true} />
        <Kb.Button mode="Secondary" label="Share" small={true} />
      </Kb.Box2>
    </Kb.Box2>
  )
  const openMeta = <Kb.Meta title="OPEN" backgroundColor={Styles.globalColors.green} />
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
    isElectron: {marginLeft: Styles.globalMargins.xtiny, marginTop: Styles.globalMargins.xxtiny},
  }),
  headerContainer: {
    ...Styles.padding(0, Styles.globalMargins.small),
  },
  tabs: {
    backgroundColor: Styles.globalColors.white,
    width: '100%',
  },
}))

export default ExternalTeam
