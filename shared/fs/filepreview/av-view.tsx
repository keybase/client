import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type Props = {
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
  onUrlError?: (err: string) => void
}

export default (props: Props) => (
  <Kb.Video url={props.url} style={styles.video} onUrlError={props.onUrlError} />
)

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
