import * as Kb from '@/common-adapters'

type Props = {
  url: string
  onLoadingStateChange?: ((isLoading: boolean) => void) | undefined
  onUrlError?: ((err: string) => void) | undefined
}

const AVPreview = (props: Props) => (
  <Kb.Video
    url={props.url}
    style={styles.video}
    {...(props.onUrlError === undefined ? {} : {onUrlError: props.onUrlError})}
  />
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
