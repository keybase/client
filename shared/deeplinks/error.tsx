import * as React from 'react'
import * as Container from '../util/container'
import * as Kb from '../common-adapters'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Styles from '../styles'

type KeybaseLinkErrorBodyProps = {
  message: string
  isError: boolean
}

export const KeybaseLinkErrorBody = (props: KeybaseLinkErrorBodyProps) => {
  const bannerColor = props.isError ? 'red' : 'green'
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Banner color={bannerColor}>
        <Kb.BannerParagraph bannerColor={bannerColor} content={props.message} selectable={true} />
      </Kb.Banner>
    </Kb.Box2>
  )
}

type OwnProps = Container.RouteProps<{errorSource: 'app' | 'sep6' | 'sep7'}>

const KeybaseLinkError = (props: OwnProps) => {
  const errorSource = Container.getRouteProps(props, 'errorSource', 'app')
  const Body = Kb.HeaderOrPopup(KeybaseLinkErrorBody)
  const message = Container.useSelector(s => {
    switch (errorSource) {
      case 'app':
        return s.deeplinks.keybaseLinkError
      case 'sep7':
        return s.wallets.sep7ConfirmError
      case 'sep6':
        return s.wallets.sep6Message
    }
  })
  const sep6Error = Container.useSelector(s => s.wallets.sep6Error)
  const isError = errorSource !== 'sep6' || sep6Error
  const dispatch = Container.useDispatch()
  const onClose = () => dispatch(RouteTreeGen.createNavigateUp())
  return <Body onCancel={onClose} customCancelText="Close" isError={isError} message={message} />
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

export default KeybaseLinkError
