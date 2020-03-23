import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as RPCGen from '../constants/types/rpc-gen'
import {pluralize} from '../util/string'

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

  return (
    <Kb.Box2 direction="vertical" gap="small" style={styles.container}>
      {waiting ? (
        <Kb.ProgressIndicator />
      ) : teamInfo ? (
        <Kb.Box2 direction="vertical" gap="small" fullWidth={true} fullHeight={true}>
          <ExternalTeamInfo info={teamInfo} />
        </Kb.Box2>
      ) : (
        <Kb.Text type="BodySmallError">There is no public information available for this team.</Kb.Text>
      )}
    </Kb.Box2>
  )
}

type ExternalTeamProps = {
  info: RPCGen.UntrustedTeamInfo
}

const ExternalTeamInfo = ({info}: ExternalTeamProps) => {
  const sections = [
    {
      data: ['header'],
      key: 'headerSection',
      renderItem: () => <Header info={info} />,
    },
  ]
  return <Kb.SectionList sections={sections} />
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
    <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
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
}))

export default ExternalTeam
