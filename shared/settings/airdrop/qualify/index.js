// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {|
  loading: boolean,
  qualified: boolean,
  onCancel: () => void,
  onSubmit: () => void,
  rows: $ReadOnlyArray<{|
    title: string,
    subTitle: string,
    valid: boolean,
  |}>,
|}

const Loading = () => (
  <Kb.Box2 noShrink={true} direction="vertical" centerChildren={true} style={styles.container} gap="medium">
    <Kb.Icon type="icon-stellar-coins-stacked-16" style={styles.star} />
    <Kb.Text center={true} type="Header" style={styles.loadingText}>
      Analyzing your account...
    </Kb.Text>
  </Kb.Box2>
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
    <Kb.Text type="Body" style={styles.rowText}>
      {p.subTitle}
    </Kb.Text>
  </Kb.Box2>
)

const Qualify = (p: Props) => (
  <Kb.MaybePopup onClose={p.onCancel}>
    {p.loading ? (
      <Loading />
    ) : (
      <Kb.ScrollView style={styles.container}>
        <Kb.Box2 noShrink={true} direction="vertical" fullWidth={true} gap="medium" style={styles.content}>
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
          <Kb.Box2 direction="vertical" style={styles.grow} />
          {p.qualified && (
            <Kb.Button
              onClick={p.onSubmit}
              fullWidth={true}
              type="PrimaryGreen"
              label="Become a lucky airdropee"
              style={styles.button}
            />
          )}
          <Kb.Button
            onClick={p.onCancel}
            fullWidth={true}
            backgroundMode="Black"
            type="PrimaryColoredBackground"
            label="Close"
            style={styles.button}
          />
        </Kb.Box2>
      </Kb.ScrollView>
    )}
  </Kb.MaybePopup>
)

const styles = Styles.styleSheetCreate({
  button: {
    flexGrow: 0,
  },
  container: {
    backgroundColor: Styles.globalColors.purple2,
    height: 550,
    padding: Styles.globalMargins.medium,
    width: 400,
  },
  content: {
    height: 550 - Styles.globalMargins.medium * 2,
    width: 400 - Styles.globalMargins.medium * 2,
  },
  grow: {flexGrow: 1},
  headerText: {color: Styles.globalColors.white},
  loadingText: {color: Styles.globalColors.white_40},
  row: {
    minHeight: Styles.globalMargins.large,
    paddingBottom: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.xsmall,
  },
  rowBorder: {
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid',
  },
  rowText: {color: Styles.globalColors.white, flexGrow: 1},
  star: {
    alignSelf: 'center',
    height: 120,
    width: 120,
  },
})

export default Qualify
