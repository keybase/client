import * as React from 'react'
import * as Kb from '../common-adapters'

type Props = {url: string}

const WebLinks = (props: Props) => {
  const uri = props.url
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true}>
      {uri && <Kb.WebView url={uri} />}
    </Kb.Box2>
  )
}

export default WebLinks
