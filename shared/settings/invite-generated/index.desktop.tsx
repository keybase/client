import * as Kb from '@/common-adapters'
import * as C from '@/constants'
import type {Props} from '.'

const InviteGeneratedRender = (props: Props) => {
  const {link, email} = props
  const onClose = C.useRouterState(s => s.dispatch.navigateUp)
  return (
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      style={{flex: 1, position: 'relative'}}
    >
      <Kb.Icon type="iconfont-close" style={styles.icon} onClick={onClose} />
      <Kb.Icon type="icon-invite-link-48" />
      {email ? (
        <Kb.Text3 center={true} type="Body" style={styles.text}>
          Yay! We emailed <Kb.Text3 type="BodySemibold">{email}</Kb.Text3>, but you can also give them the below
          link:
        </Kb.Text3>
      ) : (
        <Kb.Text3 center={true} type="Body" style={styles.text}>
          Yay! Please share the below link with your friend. It contains signup &amp; install instructions.
        </Kb.Text3>
      )}
      <Kb.Box2 direction="horizontal" alignItems="center" style={styles.linkContainer}>
        <Kb.Icon
          type="iconfont-link"
          style={{height: 14, marginRight: Kb.Styles.globalMargins.tiny}}
          color={Kb.Styles.globalColors.black_10}
        />
        <Kb.Text3 type="BodySemibold" selectable={true} style={{color: Kb.Styles.globalColors.greenDark}}>
          {link}
        </Kb.Text3>
      </Kb.Box2>
      <Kb.Button style={{marginTop: Kb.Styles.globalMargins.medium}} label="Close" onClick={onClose} />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  icon: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.desktopStyles.clickable,
      position: 'absolute',
      right: Kb.Styles.globalMargins.small,
      top: Kb.Styles.globalMargins.small,
    },
  }),
  linkContainer: {
    backgroundColor: Kb.Styles.globalColors.greenLighter,
    borderRadius: Kb.Styles.borderRadius,
    height: 32,
    marginTop: Kb.Styles.globalMargins.tiny,
    paddingLeft: Kb.Styles.globalMargins.xsmall,
    paddingRight: Kb.Styles.globalMargins.xsmall,
  },

  text: {
    paddingTop: Kb.Styles.globalMargins.medium,
    width: 440,
  },
}))
export default InviteGeneratedRender
