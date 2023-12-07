import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import Footer from '../footer/footer'
import View from './view'
import * as Kbfs from '../common'

type Props = {
  onBack: () => void
  path: T.FS.Path
}

const BarePreview = (props: Props) => {
  const onUrlError = Kbfs.useFsFileContext(props.path)
  return (
    <Kb.Box style={styles.container}>
      <Kb.Box style={styles.header}>
        <Kb.ClickableBox onClick={props.onBack} style={styles.closeBox}>
          <Kb.Text type="Body" style={styles.text}>
            Close
          </Kb.Text>
        </Kb.ClickableBox>
      </Kb.Box>
      <Kb.Box style={styles.contentContainer}>
        <View path={props.path} onUrlError={onUrlError} />
      </Kb.Box>
      <Kb.Box style={styles.footer}>
        <Kbfs.PathItemAction
          path={props.path}
          clickable={{actionIconWhite: true, type: 'icon'}}
          initView={T.FS.PathItemActionMenuView.Root}
          mode="screen"
        />
      </Kb.Box>
      <Footer path={props.path} onlyShowProofBroken={true} />
    </Kb.Box>
  )
}

export default BarePreview

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
