import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'
import * as RPCGen from '../constants/types/rpc-gen'

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
      <Kb.Text type="Header">{teamname}</Kb.Text>
      {waiting ? (
        <Kb.ProgressIndicator />
      ) : teamInfo ? (
        <Kb.Box2 direction="vertical" gap="small" fullWidth={true}>
          <Kb.Text type="BodySmall">{teamInfo?.description}</Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Text type="BodySmallError">There is no public information available for this team.</Kb.Text>
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    padding: Styles.globalMargins.small,
  },
}))

export default ExternalTeam
