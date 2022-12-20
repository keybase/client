import type * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Kbfs from '../common'
import Footer from '../footer/footer'
import View from './view'

type NormalPreviewProps = {
  path: Types.Path
  onUrlError: (err: string) => void
}

const NormalPreview = (props: NormalPreviewProps) => (
  <Kb.Box2 direction="vertical" fullHeight={true} fullWidth={true}>
    <Kbfs.Errs />
    <Kb.Box2
      direction="vertical"
      centerChildren={true}
      fullWidth={true}
      fullHeight={true}
      style={styles.greyContainer}
    >
      <View path={props.path} onUrlError={props.onUrlError} />
    </Kb.Box2>
    <Footer path={props.path} />
  </Kb.Box2>
)

export default NormalPreview

const styles = Styles.styleSheetCreate(
  () =>
    ({
      contentContainer: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxColumn,
          ...Styles.globalStyles.flexGrow,
          height: '100%',
          width: '100%',
        },
        isElectron: {
          paddingLeft: Styles.globalMargins.medium,
          paddingRight: Styles.globalMargins.medium,
        },
      }),
      greyContainer: {
        backgroundColor: Styles.globalColors.blueLighter3,
        flex: 1,
        flexShrink: 1,
      },
    } as const)
)
