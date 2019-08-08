import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/wallets'
import * as Constants from '../../../constants/wallets'
import * as Styles from '../../../styles'
import shallowEqual from 'shallowequal'

type Props = {
  state: Types.AirdropState
  onCancel: () => void
  onLoad: () => void
  onSubmit: () => void
  rows: ReadonlyArray<{
    title: string
    subTitle: string
    valid: boolean
  }>
}

const Accepted = p =>
  Styles.isMobile && p.state !== 'accepted' ? null : (
    <Kb.ScrollView
      style={styles.scrollView}
      className={Styles.classNames({
        'fade-anim-enter': true,
        'fade-anim-enter-active': p.state === 'accepted',
      })}
      contentContainerStyle={styles.scrollViewContent}
    >
      <Kb.Box2 noShrink={true} fullWidth={true} direction="vertical" style={styles.content} gap="medium">
        <Kb.Box2 direction="vertical" style={styles.grow} />
        <Kb.Icon type="icon-fancy-airdrop-shining-120" style={styles.star} />
        <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} alignItems="center">
          <Kb.Text negative={true} center={true} type="Header">
            You're in!
          </Kb.Text>
          <Kb.Text negative={true} center={true} type="Body">
            Your Lumens will show up in your default wallet account.
          </Kb.Text>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.grow} />
        <Kb.Divider />
        <Kb.Box2 direction="vertical" style={styles.grow} />
        <Kb.Box2 direction="vertical" gap="xtiny" fullWidth={true} alignItems="center">
          <Kb.Text negative={true} center={true} type="BodySemibold">
            Now bring your friends!
          </Kb.Text>
          <Kb.Box2 direction={Styles.isMobile ? 'vertical' : 'horizontal'}>
            <Kb.Text negative={true} center={true} type="Body" style={styles.friendText}>
              Share this link:{' '}
            </Kb.Text>
            <Kb.Text
              negative={true}
              center={true}
              type="BodyPrimaryLink"
              onClickURL="https://keybase.io/airdrop"
            >
              https://keybase.io/airdrop
            </Kb.Text>
          </Kb.Box2>
        </Kb.Box2>
        <Kb.Box2 direction="vertical" style={styles.grow} />
        <Kb.Button
          onClick={p.onCancel}
          fullWidth={true}
          type="Wallet"
          label="Close"
          style={styles.buttonClose}
        />
      </Kb.Box2>
    </Kb.ScrollView>
  )

const Row = p => (
  <Kb.Box2
    noShrink={true}
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([styles.row, !p.first && styles.rowBorder])}
  >
    <Kb.Box2 noShrink={true} direction="horizontal" fullWidth={true}>
      <Kb.Text type="BodySemibold" style={styles.rowText}>
        {p.title}
      </Kb.Text>
      {p.loading && <Kb.ProgressIndicator style={styles.progress} white={true} />}
      {!p.loading && (
        <Kb.Icon
          type={p.valid ? 'iconfont-check' : 'iconfont-close'}
          color={p.valid ? Styles.globalColors.green : Styles.globalColors.red}
          sizeType={'Default'}
        />
      )}
    </Kb.Box2>
    {!p.loading && !!p.subTitle && (
      <Kb.Text type="Body" style={styles.rowText}>
        {p.subTitle}
      </Kb.Text>
    )}
  </Kb.Box2>
)

type State = {
  rowIdxLoaded: number
}

class Qualified extends React.PureComponent<Props, State> {
  state = {
    rowIdxLoaded: -1,
  }
  _loadingTimerID: NodeJS.Timeout | null = null

  _kickNextLoad = () => {
    if (__STORYSHOT__) {
      return
    }
    this._loadingTimerID && clearTimeout(this._loadingTimerID)
    this._loadingTimerID = null
    if (this.state.rowIdxLoaded >= this.props.rows.length - 1) {
      return
    }

    // wait extra long on last row
    if (this.state.rowIdxLoaded === this.props.rows.length - 2) {
      this._loadingTimerID = setTimeout(() => this.setState(p => ({rowIdxLoaded: p.rowIdxLoaded + 1})), 2500)
    } else {
      this._loadingTimerID = setTimeout(() => this.setState(p => ({rowIdxLoaded: p.rowIdxLoaded + 1})), 1000)
    }
  }

  componentWillUnmount() {
    this._loadingTimerID && clearTimeout(this._loadingTimerID)
    this._loadingTimerID = null
  }

  componentDidMount() {
    this._kickNextLoad()
  }

  componentDidUpdate(prevProps) {
    // got new rows or more to load
    if (!shallowEqual(this.props.rows, prevProps.rows)) {
      this.setState({rowIdxLoaded: -1})
      this._kickNextLoad()
    } else if (this.state.rowIdxLoaded < this.props.rows.length) {
      this._kickNextLoad()
    }
  }

  render() {
    const rows = this.props.rows
    const loadingRows = !!rows.length && this.state.rowIdxLoaded < rows.length - 1
    const loading = this.props.state === 'loading' || !!loadingRows

    if (Styles.isMobile && this.props.state === 'accepted') {
      return null
    }

    let starIcon
    let description

    if (loading) {
      starIcon = 'icon-fancy-airdrop-faded-120'
      description = 'Analyzing your account...'
    } else {
      starIcon =
        this.props.state === 'qualified' ? 'icon-fancy-airdrop-shining-120' : 'icon-fancy-airdrop-faded-120'

      description =
        this.props.state === 'qualified'
          ? 'You are qualified to join!'
          : 'Sorry, you are not qualified to join.'
    }

    return (
      <Kb.ScrollView
        style={styles.scrollView}
        className={Styles.classNames({
          'fade-anim-enter': true,
          'fade-anim-enter-active': this.props.state !== 'accepted',
        })}
        contentContainerStyle={styles.scrollViewContent}
      >
        <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true} gap="tiny" style={styles.content}>
          <>
            <Kb.Icon type={starIcon} style={styles.star} />
          </>
          <Kb.Box2 direction="vertical" style={styles.titleBox}>
            <Kb.Text
              center={true}
              type={loading ? 'BodySmallSemibold' : 'Header'}
              style={loading ? styles.loadingText : styles.headerText}
            >
              {description}
            </Kb.Text>
          </Kb.Box2>
          <Kb.Box2
            direction="vertical"
            className={Styles.classNames({
              growFadeInBig: rows.length,
              growFadeInSmall: true,
            })}
          >
            {rows.map((r, idx) => (
              <Row key={r.title} {...r} first={idx === 0} loading={idx > this.state.rowIdxLoaded} />
            ))}
          </Kb.Box2>
          <Kb.Box2 direction="vertical" style={styles.grow} />
          {this.props.state === 'qualified' && (
            <Kb.WaitingButton
              onClick={this.props.onSubmit}
              fullWidth={true}
              type="Success"
              label="Become a lucky airdropee"
              disabled={loadingRows}
              waitingKey={Constants.airdropWaitingKey}
              style={loading ? styles.buttonAcceptLoading : styles.buttonAccept}
            />
          )}
          <Kb.Button
            onClick={this.props.onCancel}
            fullWidth={true}
            type="Wallet"
            label="Close"
            style={styles.buttonClose}
          />
        </Kb.Box2>
      </Kb.ScrollView>
    )
  }
}

class Qualify extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.onLoad()
  }
  render() {
    return (
      <Kb.MaybePopup
        onClose={this.props.onCancel}
        styleContainer={Styles.isMobile ? undefined : styles.popupContainer}
      >
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} style={styles.container}>
          <Accepted {...this.props} />
          <Qualified {...this.props} />
        </Kb.Box2>
      </Kb.MaybePopup>
    )
  }
}

const styles = Styles.styleSheetCreate({
  buttonAccept: {flexGrow: 0},
  buttonAcceptLoading: {flexGrow: 0, opacity: 0},
  buttonClose: {
    backgroundColor: Styles.globalColors.black_20,
    flexGrow: 0,
  },
  container: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.purple},
    isElectron: {
      height: 550,
      width: 400,
    },
    isMobile: {
      height: '100%',
      width: '100%',
    },
  }),
  content: Styles.platformStyles({
    isElectron: {
      minHeight: 550,
      padding: Styles.globalMargins.medium,
    },
    isMobile: {
      minHeight: '100%',
      padding: Styles.globalMargins.small,
    },
  }),
  friendText: Styles.platformStyles({
    isElectron: {whiteSpace: 'pre'},
  }),
  grow: {
    flexGrow: 1,
    flexShrink: 1,
    width: 100,
  },
  headerText: {color: Styles.globalColors.white},
  loadingText: {color: Styles.globalColors.white_40},
  popupContainer: {backgroundColor: Styles.globalColors.purple},
  progress: Styles.platformStyles({
    common: {
      color: Styles.globalColors.white_75,
    },
    isElectron: {
      height: 16,
      width: 16,
    },
    isMobile: {
      height: 22,
      width: 22,
    },
  }),
  row: Styles.platformStyles({
    common: {
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
    isElectron: {
      minHeight: Styles.globalMargins.large,
      paddingBottom: Styles.globalMargins.xsmall,
      paddingTop: Styles.globalMargins.xsmall,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.xsmall,
      paddingTop: Styles.globalMargins.xsmall,
    },
  }),
  rowBorder: {
    borderStyle: 'solid',
    borderTopColor: Styles.globalColors.black_10,
    borderTopWidth: 1,
  },
  rowText: {
    color: Styles.globalColors.white,
    flexGrow: 1,
    flexShrink: 1,
    marginRight: Styles.globalMargins.medium,
  },
  scrollView: {...Styles.globalStyles.fillAbsolute},
  scrollViewContent: {
    flex: 1,
  },
  star: {
    alignSelf: 'center',
    height: 120,
    marginTop: Styles.globalMargins.medium,
    width: 120,
  },
  titleBox: {
    justifyContent: 'center',
    marginBottom: Styles.globalMargins.small,
    marginTop: Styles.globalMargins.medium,
  },
})

export default Qualify
