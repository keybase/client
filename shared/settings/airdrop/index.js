// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {|
  onCheckQualify: () => void,
  signedUp: boolean,
|}

const Airdrop = (p: Props) => (
  <Kb.ScrollView style={styles.scrollView}>
    <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
        <Kb.Box2 direction="vertical" fullHeight={true} centerChildren={true}>
          <Kb.Icon type="icon-stellar-coins-flying-48" style={styles.bigStar} />
        </Kb.Box2>
        <Kb.Box2 direction="vertical">
          <Kb.Text type="Body">Get free lumens every month</Kb.Text>
          <Kb.Text type="Body">TODO</Kb.Text>
          <Kb.Button
            backgroundMode="Purple"
            type="PrimaryColoredBackground"
            label="See if you qualify"
            onClick={p.onCheckQualify}
          />
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true} style={styles.body} gap="small">
        <>
          <Kb.Text type="Body">What is this?</Kb.Text>
          <Kb.Text type="Body">See it as...</Kb.Text>
        </>
        <>
          <Kb.Text type="Body">What is this?</Kb.Text>
          <Kb.Text type="Body">See it as...</Kb.Text>
        </>
        <>
          <Kb.Text type="Body">What is this?</Kb.Text>
          <Kb.Text type="Body">See it as...</Kb.Text>
        </>
      </Kb.Box2>
    </Kb.Box2>
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  bigStar: {
    height: 150,
    width: 150,
  },
  body: {
    padding: Styles.globalMargins.small,
  },
  header: {
    backgroundColor: Styles.globalColors.purple3,
    padding: Styles.globalMargins.medium,
  },
  scrollView: {
    height: '100%',
    width: '100%',
  },
})

export default Airdrop
