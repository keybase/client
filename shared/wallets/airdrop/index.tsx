import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/wallets'
import * as Styles from '../../styles'
import * as Types from '../../constants/types/wallets'
import {iconMeta} from '../../common-adapters/icon.constants'
import openURL from '../../util/open-url'

export type Props = {
  loading: boolean
  onBack: () => void
  onLoad: () => void
  onCheckQualify: () => void
  onReject: () => void
  signedUp: boolean
  headerBody: string
  headerTitle: string
  sections: Types.StellarDetailsSections
  title: string
}

class Loading extends React.Component<
  {},
  {
    waited: boolean
  }
> {
  state = {waited: false}
  _id: NodeJS.Timeout | undefined

  componentDidMount() {
    this._id = setTimeout(() => this.setState({waited: true}), 1000)
  }

  componentWillUnmount() {
    this._id && clearTimeout(this._id)
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

const Friends = () => (
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
            selectable={true}
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
    <Kb.Icon type="icon-fancy-airdrop-shining-80" />
  </Kb.Box2>
)

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
            <Kb.Box2 direction="horizontal" fullWidth={true} noShrink={true}>
              <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.signedUpHeader} gap="tiny">
                <Kb.Icon type="icon-airdrop-logo-32" />
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
                <Kb.Icon type="icon-fancy-airdrop-shining-120" />
              </Kb.Box2>
              <Kb.Box2 direction="vertical" gap="small" style={styles.headerText}>
                <Kb.Markdown selectable={true} styleOverride={headerOverride}>{p.headerTitle}</Kb.Markdown>
                <Kb.Markdown selectable={true} styleOverride={bodyOverride}>{p.headerBody}</Kb.Markdown>
                <Kb.Button
                  backgroundColor="purple"
                  label="See if you qualify"
                  onClick={this._onCheckQualify}
                  style={styles.bannerButton}
                />
              </Kb.Box2>
            </Kb.Box2>
          )}
          {p.signedUp && <Friends />}
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
                  <Kb.Markdown selectable={true} style={styles.section} styleOverride={sectionOverride}>
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
                      <Kb.Markdown selectable={true} styleOverride={sectionBodyOverride}>{l.text}</Kb.Markdown>
                    </Kb.Box2>
                  ))}
                </Kb.Box2>
                {validIcon(b.icon) && <Kb.Icon type={b.icon as any} />}
              </Kb.Box2>
            ))}
          </Kb.Box2>
          {!p.signedUp && (
            <Kb.Box2 direction="horizontal">
              <Kb.Button
                style={styles.qualifyButton}
                type="Success"
                label="See if you qualify"
                onClick={this._onCheckQualify}
              />
            </Kb.Box2>
          )}
          <Kb.Box2 direction="vertical" style={styles.grow} />

          {!p.signedUp && <Friends />}

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
    textAlign: Styles.isMobile ? ('center' as const) : ('left' as const),
  },
  strong: {...Styles.globalStyles.fontExtrabold},
}
const bodyOverride = {
  paragraph: {
    color: Styles.globalColors.white,
    fontSize: Styles.isMobile ? 16 : 13,
    textAlign: Styles.isMobile ? ('center' as const) : ('left' as const),
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
    alignSelf: Styles.isMobile ? ('center' as const) : ('flex-start' as const),
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
    ...Styles.padding(Styles.globalMargins.small, Styles.globalMargins.medium),
    backgroundColor: Styles.globalColors.blueLighter3,
    display: 'flex',
    flexWrap: 'wrap',
  },
  friendText: Styles.platformStyles({
    isElectron: {whiteSpace: 'pre'},
  }),
  fullHeight: {height: '100%'},
  grow: {flexGrow: 1, flexShrink: 1, width: 100},
  header: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.purple,
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
  link: {color: Styles.globalColors.purpleDark, fontWeight: '600'},
  progress: {
    height: 20,
    width: 20,
  },
  qualifyButton: {
    marginLeft: Styles.globalMargins.tiny,
    marginRight: Styles.globalMargins.tiny,
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
      backgroundColor: Styles.globalColors.greenLighter,
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
    color: Styles.globalColors.greenDark,
    flexShrink: 1,
  },
})

export default (Styles.isMobile ? Kb.HeaderHoc(Airdrop) : Airdrop)
