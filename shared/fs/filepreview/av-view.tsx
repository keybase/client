import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

type Props = {
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
  onUrlError?: (err: string) => void
}

const AVPreview = (props: Props) => {
  const styles = useStyles()
  return (
    <Kb.Video url={props.url} style={styles.video} onUrlError={props.onUrlError} testID={TestIDs.FILES_VIDEO_PREVIEW} />
  )
}
export default AVPreview

const useStyles = Kb.Styles.createStyleHook(
  theme =>
    ({
      video: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.marginV(Kb.Styles.globalMargins.medium),
        },
        isMobile: {
          backgroundColor: theme.blueLighter3,
        },
      }),
    }) as const
)
