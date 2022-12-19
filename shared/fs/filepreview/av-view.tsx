import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type Props = {
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
  onUrlError?: (err: string) => void
}

const AVPreview = (props: Props) => (
  <Kb.Video url={props.url} style={styles.video} onUrlError={props.onUrlError} />
)
export default AVPreview

const styles = Styles.styleSheetCreate(
  () =>
    ({
      video: Styles.platformStyles({
        isElectron: {
          marginBottom: Styles.globalMargins.medium,
          marginTop: Styles.globalMargins.medium,
        },
        isMobile: {
          backgroundColor: Styles.globalColors.blueLighter3,
        },
      }),
    } as const)
)
