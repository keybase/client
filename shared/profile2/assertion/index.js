// @flow
import * as React from 'react'
import * as Types from '../../constants/types/profile2'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Flow from '../../util/flow'

type Props = {|
  color: Types.AssertionColor,
  metas: $ReadOnlyArray<Types._AssertionMeta>,
  onClickBadge: () => void,
  onShowProof: () => void,
  onShowSite: () => void,
  onShowUserOnSite: () => void,
  proofURL: string,
  siteIcon: string, // TODO handle actual urls, for now just use iconfont
  siteURL: string,
  state: Types.AssertionState,
  type: string,
  value: string,
|}

const stateToIcon = state => {
  switch (state) {
    case 'checking':
      return 'iconfont-proof-pending'
    case 'valid':
      return 'iconfont-proof-good'
    case 'error':
      return 'iconfont-proof-broken'
    case 'warning':
      return 'iconfont-proof-good'
    case 'revoked':
      return 'iconfont-proof-broken'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(state)
      throw new Error('Impossible')
  }
}

const stateToColor = state => {
  switch (state) {
    case 'checking':
      return Styles.globalColors.black_40
    case 'valid':
      return Styles.globalColors.blue2
    case 'error':
      return Styles.globalColors.red
    case 'warning':
      return Styles.globalColors.blue2
    case 'revoked':
      return Styles.globalColors.red
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(state)
      throw new Error('Impossible')
  }
}

const assertionColorToColor = (c: Types.AssertionColor) => {
  switch (c) {
    case 'blue':
      return Styles.globalColors.blue
    case 'red':
      return Styles.globalColors.red
    case 'black':
      return Styles.globalColors.black
    case 'green':
      return Styles.globalColors.green
    case 'gray':
      return Styles.globalColors.black_40
    case 'yellow':
      return Styles.globalColors.yellow
    case 'orange':
      return Styles.globalColors.orange
    default:
      return Styles.globalColors.red
  }
}

// TODO get read icon from core
const siteIcon = icon => {
  switch (icon) {
    case 'bitcoin':
      return 'iconfont-identity-bitcoin'
    case 'facebook':
      return 'iconfont-identity-facebook'
    case 'github':
      return 'iconfont-identity-github'
    case 'hackernews':
      return 'iconfont-identity-hn'
    case 'pgp':
      return 'iconfont-identity-pgp'
    case 'reddit':
      return 'iconfont-identity-reddit'
    case 'stellar':
      return 'iconfont-identity-stellar'
    case 'twitter':
      return 'iconfont-identity-twitter'
    case 'http':
      return 'iconfont-identity-website'
    case 'https':
      return 'iconfont-identity-website'
    case 'zcash':
      return 'iconfont-identity-zcash'
    default:
      return 'iconfont-identity-website'
  }
}

const Value = ({type, value, color, onShowUserOnSite}) => {
  let str = value
  let style = styles.username

  switch (type) {
    case 'pgp': {
      const last = value.substr(value.length - 16).toUpperCase()
      str = `${last.substr(0, 4)} ${last.substr(4, 4)} ${last.substr(8, 4)} ${last.substr(12, 4)}`
      break
    }
    case 'bitcoin':
      style = styles.bitcoin
      break
  }

  return (
    <Kb.Text
      type="BodyPrimaryLink"
      onClick={onShowUserOnSite}
      style={Styles.collapseStyles([style, {color}])}
    >
      {str}
    </Kb.Text>
  )
}

const Assertion = (p: Props) => (
  <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true}>
    <Kb.Box2 direction="horizontal" gap="tiny" fullWidth={true} gapStart={true} gapEnd={true}>
      <Kb.Icon type={siteIcon(p.type)} onClick={p.onShowSite} color={Styles.globalColors.black_75} />
      <Kb.Text type="Body" style={styles.textContainer}>
        <Value
          type={p.type}
          value={p.value}
          color={assertionColorToColor(p.color)}
          onShowUserOnSite={p.onShowUserOnSite}
        />
        <Kb.Text type="Body" style={styles.site}>
          @{p.type}
        </Kb.Text>
      </Kb.Text>
      <Kb.Icon
        boxStyle={styles.stateIcon}
        type={stateToIcon(p.state)}
        fontSize={20}
        onClick={p.onClickBadge}
        hoverColor={stateToColor(p.state)}
        color={assertionColorToColor(p.color)}
      />
    </Kb.Box2>
    {!!p.metas.length && (
      <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.metaContainer}>
        {p.metas.map(m => (
          <Kb.Meta key={m.label} backgroundColor={assertionColorToColor(m.color)} title={m.label} />
        ))}
      </Kb.Box2>
    )}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  bitcoin: Styles.platformStyles({
    isElectron: {display: 'inline-block', wordBreak: 'break-all', fontSize: 11},
  }),
  container: {flexShrink: 0, paddingBottom: 4, paddingTop: 4},
  metaContainer: {flexShrink: 0, paddingLeft: 20 + Styles.globalMargins.tiny * 2 - 4}, // icon spacing plus meta has 2 padding for some reason
  site: {color: Styles.globalColors.black_20},
  stateIcon: {height: 17},
  textContainer: {flexGrow: 1, marginTop: -1},
  username: Styles.platformStyles({
    isElectron: {display: 'inline-block', wordBreak: 'break-all'},
  }),
})

export default Assertion
