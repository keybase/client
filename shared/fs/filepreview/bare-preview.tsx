import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as FS from '@/stores/fs'
import Footer from '../footer/footer'
import View from './view'
import * as Kbfs from '../common'

type OwnProps = {path: T.FS.Path}

const ConnectedBarePreview = (ownProps: OwnProps) => {
  const path = ownProps.path ?? FS.defaultPath
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onBack = () => navigateUp()

  const onUrlError = Kbfs.useFsFileContext(path)
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.header}>
        <Kb.ClickableBox onClick={onBack} style={styles.closeBox}>
          <Kb.Text type="Body" style={styles.text}>
            Close
          </Kb.Text>
        </Kb.ClickableBox>
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.contentContainer}>
        <View path={path} onUrlError={onUrlError} />
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" alignItems="center" fullWidth={true} style={styles.footer}>
        <Kbfs.PathItemAction
          path={path}
          clickable={{actionIconWhite: true, type: 'icon'}}
          initView={T.FS.PathItemActionMenuView.Root}
          mode="screen"
        />
      </Kb.Box2>
      <Footer path={path} onlyShowProofBroken={true} />
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      closeBox: {
        height: 48,
        paddingLeft: Kb.Styles.globalMargins.tiny,
        width: 64,
      },
      container: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexGrow,
          backgroundColor: Kb.Styles.globalColors.blackOrBlack,
        },
      }),
      contentContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
      },
      footer: {
        height: 48,
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      header: {
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      text: {
        color: Kb.Styles.globalColors.whiteOrBlueDark,
        lineHeight: 48,
      },
    }) as const
)

const Noop = (_: OwnProps) => {
  return null
}

export default C.isMobile ? ConnectedBarePreview : Noop
