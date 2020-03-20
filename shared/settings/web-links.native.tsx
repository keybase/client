import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Container from '../util/container'

type Props = Container.RouteProps<{url: string; title: string}>

const WebLinks = (props: Props) => {
  const uri = Container.getRouteProps(props, 'url', '')
  const source = React.useMemo(() => ({uri}), [uri])

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      {source && <Kb.NativeWebView source={source} />}
    </Kb.Box2>
  )
}
WebLinks.navigationOptions = ({navigation}) => ({
  header: undefined,
  title: navigation.state.params.title,
})

export default WebLinks
