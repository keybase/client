// @flow
import * as React from 'react'
import * as Types from '../../constants/types/profile2'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import * as Flow from '../../util/flow'

type Props = {|
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
        {p.value}
      </Kb.Text>
      <Kb.Text type="Body" style={styles.site}>
        {p.type}
      </Kb.Text>
    </Kb.Text>
    <Kb.Icon
      type={stateToIcon(p.state)}
      fontSize={20}
      onClick={p.onClickBadge}
      hoverColor={stateToColor(p.state)}
      color={stateToColor(p.state)}
    />
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {flexShrink: 0, paddingBottom: 2, paddingTop: 2},
  site: {color: Styles.globalColors.black_20},
  textContainer: {flexGrow: 1, marginTop: -1},
  username: Styles.platformStyles({
    isElectron: {display: 'inline-block', wordBreak: 'break-all'},
  }),
})

export default Assertion
