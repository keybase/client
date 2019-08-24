import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Container from '../../util/container'
import * as RouteTreeGen from '../../actions/route-tree-gen'

const WhatIsStellarModalBody = () => (
  <Kb.ScrollView>
    <Kb.Box2 direction="vertical" style={styles.container}>
      <Kb.Icon
        type="iconfont-identity-stellar"
        sizeType="Huge"
        color={Styles.globalColors.black}
        boxStyle={styles.stellarIcon}
        style={styles.stellarIcon}
      />
      <Kb.Text type="Header" style={styles.header} selectable={true}>
        What is Stellar?
      </Kb.Text>
      <Kb.Markdown selectable={true}>
        {`Stellar is a multi-currency payment network that hundreds of thousands of people use every day. It’s decentralized, open-source, and developer-friendly, so anyone can issue assets, settle payments, and trade balances.

Stellar uses blockchain, but Stellar was designed to work more like cash—it’s much faster and cheaper than bitcoin, for example. And Stellar uses far less electricity.

Here’s everything that makes Stellar powerful:`}
      </Kb.Markdown>
      <Kb.Text type="BodyBig" style={styles.subheader} selectable={true}>
        Stellar is good for every asset
      </Kb.Text>
      <Kb.Text type="Body" selectable={true}>
        Creating a token on Stellar is as simple as following a template. There are no complicated smart
        contracts to execute, and issuers can tailor a token to meet their needs. Not only that, but tethering
        a Stellar token to a real-world asset like a dollar or an ounce of gold is easy. Which means Stellar
        supports the currencies that most of the world cares about, not just crypto.
      </Kb.Text>
      <Kb.Text type="BodyBig" style={styles.subheader} selectable={true}>
        Trading is built in
      </Kb.Text>
      <Kb.Text type="Body" selectable={true}>
        Any asset on Stellar can be exchanged for any other asset at the core level--no relayers or
        smart-contracts required. You can literally buy or sell anything on Stellar. Settlement takes just a
        few seconds. That means Stellar functions as both a cross-currency transaction system and a global
        marketplace.
      </Kb.Text>
      <Kb.Text type="BodyBig" style={styles.subheader} selectable={true}>
        The network is transparent, and belongs to everyone
      </Kb.Text>
      <Kb.Text type="Body" selectable={true}>
        The Stellar network is made up of computers connected across the globe, all owned and operated by
        different entities. No one organization controls the network, so no one can shut it off, monopolize
        its functionality, or horde its data. Not only that, but the code those computers run is open source,
        and the transactions they process are published on a shared public ledger. Everything about Stellar is
        out in the open.
      </Kb.Text>
    </Kb.Box2>
  </Kb.ScrollView>
)

const WhatIsStellarModal = () => {
  const Body = Kb.HeaderOrPopup(WhatIsStellarModalBody)
  const dispatch = Container.useDispatch()
  const onClose = () => dispatch(RouteTreeGen.createNavigateUp())
  return <Body onCancel={onClose} customCancelText="Close" borderless={true} />
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    isElectron: {
      padding: Styles.globalMargins.xlarge,
      width: 560,
    },
    isMobile: {
      marginBottom: Styles.globalMargins.mediumLarge,
      marginLeft: Styles.globalMargins.mediumLarge,
      marginRight: Styles.globalMargins.mediumLarge,
      marginTop: Styles.globalMargins.xsmall,
    },
  }),
  header: {
    alignSelf: 'center',
    marginBottom: Styles.globalMargins.mediumLarge,
    marginTop: Styles.globalMargins.small,
  },
  stellarIcon: {
    alignSelf: 'center',
  },
  subheader: {
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.mediumLarge,
  },
})

export default WhatIsStellarModal
