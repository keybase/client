// @flow
import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Styles from '../../styles'
import {iconMeta} from '../../common-adapters/icon.constants'
import openURL from '../../util/open-url'

type Props = {|
  loading: boolean,
  onBack: () => void,
  onLoad: () => void,
  onCheckQualify: () => void,
  onReject: () => void,
  signedUp: boolean,
  headerBody: string,
  headerTitle: string,
  sections: $ReadOnlyArray<{|
    lines: $ReadOnlyArray<{|bullet: boolean, text: string|}>,
    section: string,
    icon: ?string,
  |}>,
  title: string,
|}

class Loading extends React.Component<{}, {waited: boolean}> {
  state = {waited: false}
  _id: TimeoutID

  componentDidMount() {
    this._id = setTimeout(() => this.setState({waited: true}), 1000)
  }

  componentWillUnmount() {
    clearTimeout(this._id)
  }

  render() {
    return (
      this.state.waited && (
        <Kb.Box2 centerChildren={true} noShrink={true} direction="vertical" gap="medium" style={styles.grow}>
          <Kb.ProgressIndicator style={styles.progress} />
          <Kb.Text type="BodySmallSemibold" style={styles.shrink}>
            Thinking...
          </Kb.Text>
        </Kb.Box2>
      )
    )
  }
}

const validIcon = (s: any) => !!s && !!iconMeta[s]

class Airdrop extends React.Component<Props> {
  _ref = React.createRef<Kb.ScrollView>()

  componentDidMount() {
    this.props.onLoad()
  }

  _onCheckQualify = () => {
    if (Styles.isMobile) {
      const scroll = this._ref.current
      if (scroll && scroll.scrollTo) {
        scroll.scrollTo({x: 0, y: 0})
      }
    }
    this.props.onCheckQualify()
  }

  render() {
    const p = this.props
    return p.loading ? (
      <Loading />
    ) : (
      <Kb.ScrollView
        ref={this._ref}
        style={styles.scrollView}
        contentContainerStyle={Styles.isMobile ? undefined : styles.fullHeight}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} gap="medium" style={styles.fullHeight}>
          {p.signedUp ? (
            <Kb.Box2 direction="horizontal" fullWidth={true}>
              <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.signedUpHeader} gap="tiny">
                <Kb.Icon type="icon-airdrop-star-32" />
                <Kb.Text type="BodySmallSemibold" style={styles.yourIn}>
                  You're in. The next Lumens airdrop will show up in your default wallet account.
                </Kb.Text>
              </Kb.Box2>
            </Kb.Box2>
          ) : (
            <Kb.Box2
              alignItems={Styles.isMobile ? 'center' : undefined}
              direction={Styles.isMobile ? 'vertical' : 'horizontal'}
              fullWidth={true}
              noShrink={true}
              style={styles.header}
            >
              <Kb.Box2 direction="vertical" centerChildren={true}>
                <Kb.Icon type="icon-fancy-airdrop-star-shining-120" />
              </Kb.Box2>
              <Kb.Box2 direction="vertical" gap="small" style={styles.headerText}>
                <Kb.Markdown styleOverride={headerOverride}>{p.headerTitle}</Kb.Markdown>
                <Kb.Markdown styleOverride={bodyOverride}>{p.headerBody}</Kb.Markdown>
                <Kb.Button
                  backgroundMode="Purple"
                  type="PrimaryColoredBackground"
                  label="See if you qualify"
                  onClick={this._onCheckQualify}
                  style={styles.bannerButton}
                />
              </Kb.Box2>
            </Kb.Box2>
          )}
          <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true} style={styles.body} gap="small">
            {p.sections.map(b => (
              <Kb.Box2
                key={b.section}
                direction="horizontal"
                gap="large"
                fullWidth={true}
                style={styles.shrink}
              >
                <Kb.Box2 direction="vertical" gap="xtiny" alignSelf="flex-start">
                  <Kb.Markdown style={styles.section} styleOverride={sectionOverride}>
                    {b.section}
                  </Kb.Markdown>
                  {b.lines.map(l => (
                    <Kb.Box2 key={l.text} direction="horizontal" fullWidth={true}>
                      {l.bullet && (
                        <Kb.Icon
                          type="iconfont-check"
                          color={Styles.globalColors.green}
                          sizeType={'Small'}
                          style={styles.bullet}
                        />
                      )}
                      <Kb.Markdown styleOverride={sectionBodyOverride}>{l.text}</Kb.Markdown>
                    </Kb.Box2>
                  ))}
                </Kb.Box2>
                {validIcon(b.icon) && <Kb.Icon type={(b.icon: any)} />}
              </Kb.Box2>
            ))}
          </Kb.Box2>
          {!p.signedUp && (
            <Kb.Button type="PrimaryGreen" label="See if you qualify" onClick={this._onCheckQualify} />
          )}
          <Kb.Box2 direction="vertical" style={styles.grow} />
          <Kb.Box2
            direction="horizontal"
            fullWidth={true}
            style={styles.friendContainer}
            gap={Styles.isMobile ? 'small' : 'large'}
            noShrink={true}
          >
            <Kb.Box2 direction="vertical" gap="tiny">
              <Kb.Text type="BodyBig">Your friends qualify?</Kb.Text>
              <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'}>
                <Kb.Text type="Body" style={styles.friendText}>
                  Tell them to visit{' '}
                </Kb.Text>
                <Kb.Text type="Body">
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
            </Kb.Box2>
            <Kb.Icon type="icon-fancy-airdrop-friends-120" />
          </Kb.Box2>
          {p.signedUp && (
            <Kb.ButtonBar style={styles.leaveButtonBar}>
              <Kb.WaitingButton
                type="Danger"
                label="Leave airdrop"
                onClick={p.onReject}
                waitingKey={Constants.airdropWaitingKey}
              />
            </Kb.ButtonBar>
          )}
        </Kb.Box2>
      </Kb.ScrollView>
    )
  }
}

const headerOverride = {
  paragraph: {
    ...Styles.globalStyles.fontSemibold,
    color: Styles.globalColors.white,
    fontSize: Styles.isMobile ? 20 : 16,
    textAlign: Styles.isMobile ? 'center' : 'left',
  },
  strong: {...Styles.globalStyles.fontExtrabold},
}
const bodyOverride = {
  paragraph: {
    color: Styles.globalColors.white,
    fontSize: Styles.isMobile ? 16 : 13,
    textAlign: Styles.isMobile ? 'center' : 'left',
  },
  strong: {...Styles.globalStyles.fontExtrabold},
}
const sectionOverride = {
  paragraph: {
    ...Styles.globalStyles.fontSemibold,
    fontSize: Styles.isMobile ? 18 : 14,
  },
  strong: {...Styles.globalStyles.fontExtrabold},
}
const sectionBodyOverride = {
  paragraph: {fontSize: Styles.isMobile ? 16 : 13},
}

const styles = Styles.styleSheetCreate({
  bannerButton: {
    alignSelf: Styles.isMobile ? 'center' : 'flex-start',
  },
  body: {
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
  bullet: {
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
    marginTop: Styles.globalMargins.xtiny,
  },
  friendContainer: {
    backgroundColor: Styles.globalColors.blue5,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
  },
  friendText: Styles.platformStyles({
    isElectron: {whiteSpace: 'pre'},
  }),
  fullHeight: {height: '100%'},
  grow: {flexGrow: 1, flexShrink: 1, width: 100},
  header: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.purple2,
      paddingBottom: Styles.globalMargins.medium,
    },
    isElectron: {paddingTop: Styles.globalMargins.medium},
  }),
  headerText: Styles.platformStyles({
    isElectron: {
      paddingRight: Styles.globalMargins.large,
    },
    isMobile: {
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
      paddingTop: Styles.globalMargins.small,
    },
  }),
  leaveButtonBar: {marginBottom: Styles.globalMargins.small},
  link: {color: Styles.globalColors.purple2, fontWeight: '600'},
  progress: {
    height: 20,
    width: 20,
  },
  scrollView: {
    height: '100%',
    width: '100%',
  },
  section: {marginBottom: Styles.globalMargins.xxtiny},
  shrink: {
    flexShrink: 1,
  },
  signedUpHeader: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.green3,
      borderRadius: Styles.borderRadius,
      flexShrink: 1,
      marginLeft: Styles.globalMargins.medium,
      marginRight: Styles.globalMargins.medium,
      marginTop: Styles.globalMargins.medium,
      padding: Styles.globalMargins.tiny,
    },
    isElectron: {alignItems: 'center'},
    isMobile: {alignItems: 'flex-start'},
  }),
  yourIn: {
    color: Styles.globalColors.green2,
    flexShrink: 1,
  },
})

export default (Styles.isMobile ? Kb.HeaderHoc(Airdrop) : Airdrop)
