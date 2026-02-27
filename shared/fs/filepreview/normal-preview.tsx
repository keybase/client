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
  <Kb.Box2 direction="vertical" fullWidth={true} flex={1}>
    <Kbfs.Errs />
    <Kb.Box2 direction="vertical" centerChildren={true} flex={1} style={styles.greyContainer}>
      <View path={props.path} onUrlError={props.onUrlError} />
    </Kb.Box2>
    <Footer path={props.path} />
  </Kb.Box2>
)

export default NormalPreview

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      greyContainer: {
        backgroundColor: Kb.Styles.globalColors.blueLighter3,
        flexShrink: 1,
        width: '100%',
      },
    }) as const
)
