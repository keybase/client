import * as React from 'react'
import * as Sb from '../../stories/storybook'
import * as Kb from '../../common-adapters'
import Asset from './asset'

const commonProps = {
  onAccept: Sb.action('onAccept'),
  onRemove: Sb.action('onRemove'),
  onViewDetails: Sb.action('onViewDetails'),
}
const Wrapper = props => {
  const [expanded, setExpanded] = React.useState(false)
  return (
    <Asset
      expanded={expanded}
      onCollapse={() => setExpanded(false)}
      onExpand={() => setExpanded(true)}
      {...commonProps}
      {...props}
    />
  )
}

const load = () => {
  Sb.storiesOf('Wallets/Trustline', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Asset', () => (
      <Kb.Box2 direction="vertical">
        <Wrapper
          firstItem={true}
          code="USD"
          issuerVerifiedDomain="Stronghold.com"
          issuerAccountID="GBQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I41"
          trusted={true}
        />
        <Wrapper
          firstItem={false}
          code="USD"
          issuerVerifiedDomain=""
          issuerAccountID="GBQTE2V7Y356T"
          trusted={false}
        />
        <Wrapper
          firstItem={false}
          code="USD"
          issuerVerifiedDomain="chase.com"
          issuerAccountID="GBQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I43"
          trusted={false}
        />
        <Wrapper
          firstItem={false}
          code="USD"
          issuerVerifiedDomain="chase.com"
          issuerAccountID="GBQTE2V7Y356TFBZL6YZ2PA3KIILNSAAQRV5C7MVWS22KQTS4EMK7I43"
          trusted={false}
        />
      </Kb.Box2>
    ))
}

export default load
