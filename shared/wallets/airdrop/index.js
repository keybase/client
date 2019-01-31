// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {iconMeta} from '../../common-adapters/icon.constants'
import openURL from '../../util/open-url'

type Props = {|
  loading: boolean,
  onBack: () => void,
  onCheckQualify: () => void,
  onReject: () => void,
  signedUp: boolean,
  body: $ReadOnlyArray<{|
    lines: $ReadOnlyArray<{|
      bullet: boolean,
      text: string,
    |}>,
    section: string,
    icon?: ?string,
  |}>,
|}

const Loading = () => (
  <Kb.ScrollView style={styles.scrollView}>
    <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true} gap="medium" centerChildren={true}>
      <Kb.ProgressIndicator />
      <Kb.Text type="BodySemibold" style={styles.shrink}>
        Loading...
      </Kb.Text>
    </Kb.Box2>
  </Kb.ScrollView>
)

const validIcon = (s: any) => !!s && !!iconMeta[s]

const Airdrop = (p: Props) =>
  p.loading ? (
    <Loading />
  ) : (
    <Kb.ScrollView style={styles.scrollView}>
      <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true} gap="medium">
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
            <Kb.Box2 key={b.section} direction="horizontal" gap="large" fullWidth={true}>
              <Kb.Box2 direction="vertical" gap="xtiny" alignSelf="flex-start">
                <Kb.Text type="BodySemibold" style={styles.section}>
                  {b.section}
                </Kb.Text>
                {b.lines.map(l => (
                  <Kb.Box2 key={l.text} direction="horizontal" fullWidth={true}>
                    {l.bullet && (
                      <Kb.Icon
                        type="iconfont-check"
                        color={Styles.globalColors.green}
                        fontSize={12}
                        style={styles.bullet}
                      />
                    )}
                    <Kb.Text type="Body">{l.text}</Kb.Text>
                  </Kb.Box2>
                ))}
              </Kb.Box2>
              {validIcon(b.icon) && <Kb.Icon type={(b.icon: any)} />}
            </Kb.Box2>
          ))}
        </Kb.Box2>
        {p.signedUp ? (
          <Kb.Button type="Danger" label="Leave program" onClick={p.onReject} />
        ) : (
          <Kb.Button type="PrimaryGreen" label="See if you qualify" onClick={p.onCheckQualify} />
        )}
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.friendContainer} gap="large">
          <Kb.Box2 direction="vertical" gap="tiny">
            <Kb.Text type="BodySemibold">Your friends qualify?</Kb.Text>
            <Kb.Text type="Body">
              Tell them to visit{' '}
              <Kb.Text
                type="BodyPrimaryLink"
                style={styles.link}
                onClick={() => openURL('https://keybase.io/airdrop')}
              >
                https://keybase.io/airdrop
              </Kb.Text>
              .
            </Kb.Text>
          </Kb.Box2>
          <Kb.Icon
            type={Styles.isMobile ? 'icon-stellar-coins-stacked-16' : 'icon-stellar-coins-flying-48'}
            style={styles.friendsStar}
          />
        </Kb.Box2>
      </Kb.Box2>
    </Kb.ScrollView>
  )

const styles = Styles.styleSheetCreate({
  bannerButton: {alignSelf: 'flex-start'},
  bigStar: Styles.platformStyles({
    isElectron: {height: 80, width: 80},
    isMobile: {height: 20, width: 20},
  }),
  body: {
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  bullet: {
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
  },
  friendContainer: {backgroundColor: Styles.globalColors.lightGrey, padding: Styles.globalMargins.small},
  friendsStar: Styles.platformStyles({
    isElectron: {height: 100, width: 100},
    isMobile: {height: 100, width: 100},
  }),
  header: {
    backgroundColor: Styles.globalColors.purple3,
    padding: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.medium,
  },
  link: {
    color: Styles.globalColors.purple,
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
