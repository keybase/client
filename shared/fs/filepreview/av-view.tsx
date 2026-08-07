import * as Kb from '@/common-adapters'

type Props = {
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
  onUrlError?: (err: string) => void
}

const AVPreview = (props: Props) => {
  const styles = useStyles()
  return (
    <Kb.Video url={props.url} style={styles.video} onUrlError={props.onUrlError} />
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
