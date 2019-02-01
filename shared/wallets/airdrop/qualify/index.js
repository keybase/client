// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/wallets'
import * as Constants from '../../../constants/wallets'
import * as Styles from '../../../styles'
import shallowEqual from 'shallowequal'

type Props = {|
  state: Types.AirdropState,
  onCancel: () => void,
  onLoad: () => void,
  onSubmit: () => void,
  rows: $ReadOnlyArray<{|
    title: string,
    subTitle: string,
    valid: boolean,
  |}>,
|}

const Accepted = p => (
  <Kb.ScrollView
    style={styles.scrollView}
    className={Styles.classNames({
      'fade-anim-enter': true,
      'fade-anim-enter-active': p.state === 'accepted',
    })}
  >
    <Kb.Box2 noShrink={true} fullWidth={true} direction="vertical" style={styles.content} gap="medium">
      <Kb.Box2 direction="vertical" style={styles.grow} />
      <Kb.Icon type="icon-stellar-coins-stacked-16" style={styles.star} />
      <Kb.Text backgroundMode="Terminal" center={true} type="Header">
        You're in.
      </Kb.Text>
      <Kb.Text center={true} type="BodySemibold" style={styles.loadingText}>
        The next airdrop will happen March 1.
      </Kb.Text>
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
      {p.loading && <Kb.ProgressIndicator style={styles.progress} />}
      {!p.loading && (
        <Kb.Icon
          type={p.valid ? 'iconfont-check' : 'iconfont-close'}
          color={p.valid ? Styles.globalColors.green : Styles.globalColors.red}
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

type State = {|
  rowIdxLoaded: number,
|}
class Qualified extends React.PureComponent<Props, State> {
  state = {
    rowIdxLoaded: -1,
  }
  _loadingTimerID: ?TimeoutID

  _kickNextLoad = () => {
    this._loadingTimerID && clearTimeout(this._loadingTimerID)
    this._loadingTimerID = undefined
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
    this._loadingTimerID = undefined
  }

  componentDidMount() {
    this._kickNextLoad()
  }

  componentDidUpdate(prevProps, prevState) {
    // got new rows or more to load
    if (!shallowEqual(this.props.rows, prevProps.rows)) {
      this.setState({rowIdxLoaded: -1})
      this._kickNextLoad()
    } else if (this.state.rowIdxLoaded < this.props.rows.length) {
      this._kickNextLoad()
    }
  }

  render() {
    const p = this.props
    const rows = this.props.rows
    const loadingRows = !!rows.length && this.state.rowIdxLoaded < rows.length - 1
    const loading = p.state === 'loading' || loadingRows

    return (
      <Kb.ScrollView
        style={styles.scrollView}
        className={Styles.classNames({
          'fade-anim-enter': true,
          'fade-anim-enter-active': p.state !== 'accepted',
        })}
      >
        <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true} gap="medium" style={styles.content}>
          <Kb.Box2 direction="vertical" style={styles.grow} />
          <Kb.Icon
            type={
              loading
                ? 'icon-stellar-coins-stacked-16'
                : p.state === 'qualified'
                ? 'icon-stellar-coins-flying-2-48'
                : 'icon-stellar-coins-flying-48'
            }
            style={styles.star}
          />
          <Kb.Text
            center={true}
            type={loading ? 'BodySemibold' : 'Header'}
            style={loading ? styles.loadingText : styles.headerText}
          >
            {loading
              ? 'Analyzing your account...'
              : p.state === 'qualified'
              ? 'You are qualified to join!'
              : 'Sorry, you are not qualified to join.'}
          </Kb.Text>
          <>
            <Kb.Box2 direction="vertical" style={styles.grow} />
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
          </>
          {p.state === 'qualified' && (
            <Kb.WaitingButton
              onClick={p.onSubmit}
              fullWidth={true}
              type="PrimaryGreen"
              label="Become a lucky airdropee"
              disabled={loadingRows}
              waitingKey={Constants.airdropWaitingKey}
              style={styles.buttonAccept}
            />
          )}
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
  }
}

class Qualify extends React.PureComponent<Props> {
  componentDidMount() {
    this.props.onLoad()
  }
  render() {
    return (
      <Kb.MaybePopup onClose={this.props.onCancel}>
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
  buttonClose: {
    backgroundColor: Styles.globalColors.black_10,
    flexGrow: 0,
  },
  container: Styles.platformStyles({
    common: {backgroundColor: Styles.globalColors.purple2},
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
    isMobile: {padding: Styles.globalMargins.small},
  }),
  grow: {
    flexGrow: 1,
    flexShrink: 1,
    width: 100,
  },
  headerText: {color: Styles.globalColors.white},
  loadingText: {color: Styles.globalColors.white_40},
  progress: {color: Styles.globalColors.white, height: 14, width: 14},
  row: Styles.platformStyles({
    isElectron: {
      minHeight: Styles.globalMargins.large,
      paddingBottom: Styles.globalMargins.xsmall,
      paddingTop: Styles.globalMargins.xsmall,
    },
    isMobile: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
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
    marginRight: Styles.globalMargins.tiny,
  },
  scrollView: {...Styles.globalStyles.fillAbsolute},
  star: {
    alignSelf: 'center',
    height: 120,
    width: 120,
  },
})

export default Qualify
