import * as React from 'react'
import * as Kb from '../common-adapters'
import type * as Container from '../util/container'

type Props = Container.RouteProps2<'webLinks'>

const WebLinks = (props: Props) => {
  const uri = props.route.params.url
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      {uri && <Kb.WebView url={uri} />}
    </Kb.Box2>
  )
}

export default WebLinks
