import * as Kb from '@/common-adapters'

type Props = {
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
  onUrlError?: (err: string) => void
}

const AVPreview = (props: Props) => (
  <Kb.Video url={props.url} style={styles.video} onUrlError={props.onUrlError} />
)
export default AVPreview

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      video: Kb.Styles.platformStyles({
        isElectron: {
          marginBottom: Kb.Styles.globalMargins.medium,
          marginTop: Kb.Styles.globalMargins.medium,
        },
        isMobile: {
          backgroundColor: Kb.Styles.globalColors.blueLighter3,
        },
      }),
    }) as const
)
