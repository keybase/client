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
        <Kb.Banner text={error} color="red" />
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
})

export default Error
