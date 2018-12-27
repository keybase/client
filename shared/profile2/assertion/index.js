// @flow
import * as React from 'react'
import * as Types from '../../constants/types/profile2'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

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

const Assertion = (p: Props) => (
  <Kb.Box2
    direction="horizontal"
    gap="tiny"
    fullWidth={true}
    style={styles.container}
    gapStart={true}
    gapEnd={true}
  >
    <Kb.Icon
      type={(p.siteIcon: any)}
      onClick={p.onShowSite}
      color={Styles.globalColors.black}
      boxStyle={styles.icon}
    />
    <Kb.Text type="Body" style={styles.textContainer}>
      <Kb.Text type="BodyPrimaryLink" onClick={p.onShowUserOnSite} style={styles.username}>
        {p.username}
      </Kb.Text>
      <Kb.Text type="Body" style={styles.site}>
        {p.site}
      </Kb.Text>
    </Kb.Text>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  container: {minHeight: 24},
  icon: {marginTop: 5},
  site: {color: Styles.globalColors.black_20},
  textContainer: {marginTop: 4},
  username: Styles.platformStyles({
    isElectron: {display: 'inline-block', wordBreak: 'break-all'},
  }),
})

export default Assertion
