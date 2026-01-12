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
    <Kb.Box style={styles.container}>
      <Kb.Box style={styles.header}>
        <Kb.ClickableBox onClick={onBack} style={styles.closeBox}>
          <Kb.Text type="Body" style={styles.text}>
            Close
          </Kb.Text>
        </Kb.ClickableBox>
      </Kb.Box>
      <Kb.Box style={styles.contentContainer}>
        <View path={path} onUrlError={onUrlError} />
      </Kb.Box>
      <Kb.Box style={styles.footer}>
        <Kbfs.PathItemAction
          path={path}
          clickable={{actionIconWhite: true, type: 'icon'}}
          initView={T.FS.PathItemActionMenuView.Root}
          mode="screen"
        />
      </Kb.Box>
      <Footer path={path} onlyShowProofBroken={true} />
    </Kb.Box>
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
          ...Kb.Styles.globalStyles.flexBoxColumn,
          ...Kb.Styles.globalStyles.flexGrow,
          backgroundColor: Kb.Styles.globalColors.blackOrBlack,
        },
      }),
      contentContainer: {
        ...Kb.Styles.globalStyles.flexGrow,
      },
      footer: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 48,
        paddingLeft: Kb.Styles.globalMargins.tiny,
      },
      header: {
        ...Kb.Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
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
