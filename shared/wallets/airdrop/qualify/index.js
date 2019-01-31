// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/wallets'
import * as Styles from '../../../styles'

type Props = {|
  state: Types.AirdropState,
  onCancel: () => void,
  onSubmit: () => void,
  rows: $ReadOnlyArray<{|
    title: string,
    subTitle: string,
    valid: boolean,
  |}>,
|}

const Loading = () => (
  <Kb.ScrollView style={styles.container}>
    <Kb.Box2 noShrink={true} direction="vertical" centerChildren={true} style={styles.content} gap="medium">
      <Kb.Icon type="icon-stellar-coins-stacked-16" style={styles.star} />
      <Kb.Text center={true} type="BodySemibold" style={styles.loadingText}>
        Analyzing your account...
      </Kb.Text>
    </Kb.Box2>
  </Kb.ScrollView>
)

const Accepted = p => (
  <Kb.ScrollView style={styles.container}>
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
      <Kb.Icon
        type={p.valid ? 'iconfont-check' : 'iconfont-close'}
        color={p.valid ? Styles.globalColors.green : Styles.globalColors.red}
      />
    </Kb.Box2>
    {!!p.subTitle && (
      <Kb.Text type="Body" style={styles.rowText}>
        {p.subTitle}
      </Kb.Text>
    )}
  </Kb.Box2>
)

const Qualified = p => (
  <Kb.ScrollView style={styles.container}>
    <Kb.Box2
      noShrink={true}
      direction="vertical"
      fullWidth={true}
      gap="medium"
      style={styles.content}
      gapEnd={true}
    >
      <Kb.Icon
        type={p.qualified ? 'icon-stellar-coins-flying-2-48' : 'icon-stellar-coins-flying-48'}
        style={styles.star}
      />
      <Kb.Text center={true} type="Header" style={styles.headerText}>
        {p.qualified ? 'You are qualified to join!' : 'Sorry, you are not qualified to join.'}
      </Kb.Text>
      <>
        {p.rows.map((r, idx) => (
          <Row key={r.title} {...r} first={idx === 0} />
        ))}
      </>
      {!Styles.isMobile && <Kb.Box2 direction="vertical" style={styles.grow} />}
      {p.state === 'qualified' && (
        <Kb.Button
          onClick={p.onSubmit}
          fullWidth={true}
          type="PrimaryGreen"
          label="Become a lucky airdropee"
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

const Qualify = (p: Props) => (
  <Kb.MaybePopup onClose={p.onCancel}>
    {p.state === 'loading' && <Loading />}
    {p.state === 'accepted' && <Accepted {...p} />}
    {(p.state === 'qualified' || p.state === 'unqualified') && <Qualified {...p} />}
  </Kb.MaybePopup>
)

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
      padding: Styles.globalMargins.medium,
      width: 400,
    },
    isMobile: {
      height: '100%',
      width: '100%',
    },
  }),
  content: Styles.platformStyles({
    isElectron: {
      height: 550 - Styles.globalMargins.medium * 2,
      width: 400 - Styles.globalMargins.medium * 2,
    },
    isMobile: {padding: Styles.globalMargins.small},
  }),
  grow: {flexGrow: 1},
  headerText: {color: Styles.globalColors.white},
  loadingText: {color: Styles.globalColors.white_40},
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
  rowText: {color: Styles.globalColors.white, flexGrow: 1, flexShrink: 1},
  star: {
    alignSelf: 'center',
    height: 120,
    width: 120,
  },
})

export default Qualify
