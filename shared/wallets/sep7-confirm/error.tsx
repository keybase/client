import * as React from 'react'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Styles from '../../styles'

type ErrorBodyProps = {
  errorText: string
}

const ErrorBody = (props: ErrorBodyProps) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Banner color="red">
        <Kb.BannerParagraph bannerColor="red" content={props.errorText} />
      </Kb.Banner>
    </Kb.Box2>
  )
}

const Error = () => {
  const Body = Kb.HeaderOrPopup(ErrorBody)
  const error = Container.useSelector(s => s.wallets.sep7ConfirmError)
  const dispatch = Container.useDispatch()
  const onClose = () => dispatch(RouteTreeGen.createNavigateUp())
  return <Body onCancel={onClose} customCancelText="Close" errorText={error} />
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
