import * as React from 'react'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'
import * as Container from '../util/container'

type Props = Container.RouteProps<{teamname: string}>

const ExternalTeam = (props: Props) => {
  const teamname = Container.getRouteProps(props, 'teamname', '')
  return <Kb.Text type="Header">{teamname}</Kb.Text>
}

export default ExternalTeam
