import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
// import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Container from '../util/container'

type Props = Container.RouteProps<{url: string; title: string}>

const WebLinks = (props: Props) => {
  const uri = Container.getRouteProps(props, 'url', '')
  const title = Container.getRouteProps(props, 'title', '')
  const source = React.useMemo(() => ({uri}), [uri])

  // const dispatch = Container.useDispatch()
  // const onBack = () => dispatch(RouteTreeGen.createNavigateUp())

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      <Kb.HeaderHocHeader leftAction="back" title={title} />
      {source && <Kb.NativeWebView source={source} />}
    </Kb.Box2>
  )
}

export default WebLinks
