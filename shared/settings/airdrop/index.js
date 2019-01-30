// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type Props = {|
  onCheckQualify: () => void,
  onReject: () => void,
  signedUp: boolean,
  body: $ReadOnlyArray<{|
    lines: $ReadOnlyArray<{|
      bullet: boolean,
      text: string,
    |}>,
    section: string,
  |}>,
|}

const Airdrop = (p: Props) => (
  <Kb.ScrollView style={styles.scrollView}>
    <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true}>
      {p.signedUp ? (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.signedUpHeader} gap="small">
          <Kb.Icon type="icon-stellar-coins-stacked-16" />
          <Kb.Text backgroundMode="Terminal" type="BodySemibold" style={styles.shrink}>
            You’re in. The next Lumens airdrop will happen March 1.
          </Kb.Text>
        </Kb.Box2>
      ) : (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.header}>
          <Kb.Box2 direction="vertical" centerChildren={true} style={styles.starContainer}>
            <Kb.Icon
              type={Styles.isMobile ? 'icon-stellar-coins-stacked-16' : 'icon-stellar-coins-flying-48'}
              style={styles.bigStar}
            />
          </Kb.Box2>
          <Kb.Box2 direction="vertical" gap="small" style={styles.shrink}>
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
      )}
      <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true} style={styles.body} gap="small">
        {p.body.map(b => (
          <Kb.Box2 key={b.section} direction="vertical" gap="xtiny" fullWidth={true}>
            <Kb.Text type="BodySemibold" style={styles.section}>
              {b.section}
            </Kb.Text>
            {b.lines.map(l => (
              <Kb.Box2 key={l.text} direction="horizontal" fullWidth={true}>
                {l.bullet && <Kb.Text type="Body"> • </Kb.Text>}
                <Kb.Text type="Body">{l.text}</Kb.Text>
              </Kb.Box2>
            ))}
          </Kb.Box2>
        ))}
      </Kb.Box2>
      {p.signedUp ? (
        <Kb.Button type="Danger" label="Leave program" onClick={p.onReject} />
      ) : (
        <Kb.Button type="PrimaryGreen" label="See if you qualify" onClick={p.onCheckQualify} />
      )}
    </Kb.Box2>
  </Kb.ScrollView>
)

const styles = Styles.styleSheetCreate({
  bannerButton: {alignSelf: 'flex-start'},
  bigStar: Styles.platformStyles({
    isElectron: {height: 80, width: 80},
    isMobile: {height: 20, width: 20},
  }),
  body: {padding: Styles.globalMargins.small},
  header: {
    backgroundColor: Styles.globalColors.purple3,
    padding: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.medium,
  },
  scrollView: {
    height: '100%',
    width: '100%',
  },
  section: {marginBottom: Styles.globalMargins.xxtiny},
  shrink: {flexShrink: 1},
  signedUpHeader: {
    backgroundColor: Styles.globalColors.green,
    flexShrink: 1,
    padding: Styles.globalMargins.tiny,
  },
  starContainer: {width: Styles.isMobile ? 40 : 150},
})

export default (Styles.isMobile ? Kb.HeaderHoc(Airdrop) : Airdrop)
