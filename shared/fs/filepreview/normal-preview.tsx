import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as Kbfs from '../common'
import Footer from '../footer/footer'
import View from './view'

type NormalPreviewProps = {
  path: T.FS.Path
  onUrlError: (err: string) => void
}

const NormalPreview = (props: NormalPreviewProps) => (
  <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
    <Kbfs.Errs />
    <Kb.Box2 direction="vertical" centerChildren={true} style={styles.greyContainer}>
      <View path={props.path} onUrlError={props.onUrlError} />
    </Kb.Box2>
    <Footer path={props.path} />
  </Kb.Box2>
)

export default NormalPreview

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      contentContainer: Kb.Styles.platformStyles({
        common: {
          ...Kb.Styles.globalStyles.flexBoxColumn,
          ...Kb.Styles.globalStyles.flexGrow,
          height: '100%',
          width: '100%',
        },
        isElectron: {
          paddingLeft: Kb.Styles.globalMargins.medium,
          paddingRight: Kb.Styles.globalMargins.medium,
        },
      }),
      greyContainer: {
        backgroundColor: Kb.Styles.globalColors.blueLighter3,
        flexGrow: 1,
        flexShrink: 1,
        width: '100%',
      },
    }) as const
)
