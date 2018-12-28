// @flow
import * as React from 'react'
import * as Types from '../../constants/types/profile2'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Flow from '../../util/flow'

type Props = {|
  site: string,
  username: string,
  siteURL: string,
  siteIcon: string, // TODO handle actual urls, for now just use iconfont
  onShowProof: () => void,
  onShowSite: () => void,
  onShowUserOnSite: () => void,
  proofURL: string,
  state: Types.AssertionState,
  metas: $ReadOnlyArray<Types._AssertionMeta>,
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

const TODO = () => {}

const Assertion = (p: Props) => (
  <Kb.Box2
    direction="horizontal"
    gap="tiny"
    fullWidth={true}
    style={styles.container}
    gapStart={true}
    gapEnd={true}
  >
    <Kb.Icon type={(p.siteIcon: any)} onClick={p.onShowSite} color={Styles.globalColors.black} />
    <Kb.Text type="Body" style={styles.textContainer}>
      <Kb.Text type="BodyPrimaryLink" onClick={p.onShowUserOnSite} style={styles.username}>
        {p.username}
      </Kb.Text>
      <Kb.Text type="Body" style={styles.site}>
        {p.site}
      </Kb.Text>
    </Kb.Text>
    <Kb.Icon type={stateToIcon(p.state)} fontSize={20} onClick={TODO} color={stateToColor(p.state)} />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {flexShrink: 0, paddingBottom: 2, paddingTop: 2},
  site: {color: Styles.globalColors.black_20},
  textContainer: {flexGrow: 1, marginTop: -1},
  // menuIconBox: {height: 20, width: 20},
  // menuIcon: {},
  username: Styles.platformStyles({
    isElectron: {display: 'inline-block', wordBreak: 'break-all'},
  }),
})

export default Assertion
