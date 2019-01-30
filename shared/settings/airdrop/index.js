// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {|
  onCheckQualify: () => void,
  signedUp: boolean,
  body: $ReadonlyArray<{|
    lines: $ReadonlyArray<string>,
    section: string,
  |}>,
|}

const Airdrop = (p: Props) => (
  <Kb.ScrollView style={styles.scrollView}>
    <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true}>
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
        <Kb.Box2 direction="vertical" fullHeight={true} centerChildren={true} style={styles.starContainer}>
          <Kb.Icon type="icon-stellar-coins-flying-48" style={styles.bigStar} />
        </Kb.Box2>
        <Kb.Box2 direction="vertical" gap="small">
          <Kb.Text backgroundMode="Terminal" type="Header">
            Get free lumens every month
          </Kb.Text>
          <Kb.Text type="Body">
            Monthly starting March 1, Keybase will divide 50,000 XLM (Stellar Lumens) among Keybase users.
          </Kb.Text>
          <Kb.Button
            backgroundMode="Purple"
            type="PrimaryColoredBackground"
            label="See if you qualify"
            onClick={p.onCheckQualify}
            style={styles.bannerButton}
          />
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true} style={styles.body} gap="small">
        {p.body.map(b => (
          <Kb.Box2 key={b.section} direction="vertical" gap="xtiny" fullWidth={true}>
            <Kb.Text type="BodySemibold" style={styles.section}>
              {b.section}
            </Kb.Text>
            {b.lines.map(l => (
              <Kb.Text key={l} type="Body">
                {l}
              </Kb.Text>
            ))}
          </Kb.Box2>
        ))}
      </Kb.Box2>
      <Kb.Button type="PrimaryGreen" label="See if you qualify" onClick={p.onCheckQualify} />
    </Kb.Box2>
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  bannerButton: {alignSelf: 'flex-start'},
  bigStar: {
    height: 80,
    width: 80,
  },
  body: {padding: Styles.globalMargins.small},
  header: {
    backgroundColor: Styles.globalColors.purple3,
    padding: Styles.globalMargins.medium,
  },
  scrollView: {
    height: '100%',
    width: '100%',
  },
  section: {
    marginBottom: Styles.globalMargins.xxtiny,
  },
  starContainer: {width: 150},
})

export default Airdrop
