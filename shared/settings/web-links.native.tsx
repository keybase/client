import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Container from '../util/container'

// this is used by acouple of routes, TODO just make this 'webLinks'
type Props = Container.RouteProps<'privacyPolicy'>

const WebLinks = (props: Props) => {
  const uri = props.route.params?.url ?? ''
  const source = React.useMemo(() => ({uri}), [uri])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      {source && <Kb.NativeWebView source={source} />}
    </Kb.Box2>
  )
}
WebLinks.navigationOptions = ({route}) => ({
  header: undefined,
  title: Container.getRouteParamsFromRoute<'privacyPolicy'>(route)?.title,
})

export default WebLinks
