import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

const starman =
  'https://archive.org/download/youtube%2DA0FZIwabctw/Falcon%5FHeavy%5FStarman%2DA0FZIwabctw%2Emp4'

const WhatIsStellarModal = (props: any) => {
  return (
    <Kb.MaybePopup onClose={props.onClose}>
      <Kb.Box2 direction="vertical" style={styles.container}>
        <Kb.Icon type="iconfont-identity-stellar" />
        <Kb.Text type="Header">What is Stellar?</Kb.Text>
        <Kb.Box style={styles.video}>
          <Kb.Video url={starman} />
        </Kb.Box>
        <Kb.Markdown>
          {`Stellar is a multi-currency payment network that hundreds of thousands of people use every day. It’s decentralized, open-source, and developer-friendly, so anyone can issue assets, settle payments, and trade balances.

Stellar uses blockchain, but Stellar was designed to work more like cash—it’s much faster and cheaper than bitcoin, for example. And Stellar uses far less electricity.

Here’s everything that makes Stellar powerful:`}
        </Kb.Markdown>
        <Kb.Box style={styles.video}>
          <Kb.Video url={starman} />
        </Kb.Box>
        <Kb.Text type="Header">Stellar is good for every asset</Kb.Text>
        <Kb.Text type="Body">
          Creating a token on Stellar is as simple as following a template. There are no complicated smart
          contracts to execute, and issuers can tailor a token to meet their needs. Not only that, but
          tethering a Stellar token to a real-world asset like a dollar or an ounce of gold is easy. Which
          means Stellar supports the currencies that most of the world cares about, not just crypto.
        </Kb.Text>
        <Kb.Box style={styles.video}>
          <Kb.Video url={starman} />
        </Kb.Box>
        <Kb.Text type="Header">Trading is built in</Kb.Text>
        <Kb.Text type="Body">
          Any asset on Stellar can be exchanged for any other asset at the core level--no relayers or
          smart-contracts required. You can literally buy or sell anything on Stellar. Settlement takes just a
          few seconds. That means Stellar functions as both a cross-currency transaction system and a global
          marketplace.
        </Kb.Text>
        <Kb.Box style={styles.video}>
          <Kb.Video url={starman} />
        </Kb.Box>
        <Kb.Text type="Header">The network is transparent, and belongs to everyone</Kb.Text>
        <Kb.Text type="Body">
          The Stellar network is made up of computers connected across the globe, all owned and operated by
          different entities. No one organization controls the network, so no one can shut it off, monopolize
          its functionality, or horde its data. Not only that, but the code those computers run is open
          source, and the transactions they process are published on a shared public ledger. Everything about
          Stellar is out in the open.
        </Kb.Text>
      </Kb.Box2>
    </Kb.MaybePopup>
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      padding: 40,
    },
    isElectron: {
      borderRadius: 4,
      overflow: 'hidden',
      width: 560,
    },
    isMobile: {
      flex: 1,
      width: '100%',
    },
  }),
  video: {
    height: 242,
  },
})

export default WhatIsStellarModal
