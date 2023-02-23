import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import type * as Container from '../util/container'

type Props = Container.RouteProps<'webLinks'>

const WebLinks = (props: Props) => {
  const uri = props.route.params?.url ?? ''
  const source = React.useMemo(() => ({uri}), [uri])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      {source && <Kb.NativeWebView source={source} />}
    </Kb.Box2>
  )
}

export default WebLinks
