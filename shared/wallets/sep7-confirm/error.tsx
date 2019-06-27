import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'

const Error = () => {
  const error = Container.useSelector(s => s.wallets.sep7ConfirmError)
  const dispatch = Container.useDispatch()
  const onBack = () => dispatch(RouteTreeGen.createNavigateUp())

  return (
    <Kb.MaybePopup onClose={onBack}>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.Box2 direction="vertical" centerChildren={true} fullWidth={true} style={styles.dialog}>
          <Kb.Text style={styles.text} type="Body">
            {error}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </Kb.MaybePopup>
  )
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
    },
    isElectron: {
      height: 560,
      width: 400,
    },
    isMobile: {
      flexGrow: 1,
      flexShrink: 1,
      maxHeight: '100%',
      width: '100%',
    },
  }),
  dialog: {
    backgroundColor: Styles.globalColors.red,
    marginTop: Styles.globalMargins.small,
    minHeight: 40,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.large,
    paddingRight: Styles.globalMargins.large,
    paddingTop: Styles.globalMargins.tiny,
  },
  text: {
    color: Styles.globalColors.white,
  },
})

export default Error
