import * as Kb from '@/common-adapters'

type Props = {url: string; title?: string}

const WebLinks = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
    {props.url && <Kb.WebView url={props.url} />}
  </Kb.Box2>
)

export default WebLinks
