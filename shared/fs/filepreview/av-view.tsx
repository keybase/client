import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'

type Props = {
  audioOnly: boolean
  url: string
  onLoadingStateChange?: (isLoading: boolean) => void
}

export default (props: Props) =>
  props.audioOnly ? (
    <Kb.Audio url={props.url} style={styles.video} autoPlay={true} controls={true} loop={true} />
  ) : (
    <Kb.Video url={props.url} style={styles.video} autoPlay={true} controls={true} loop={true} />
  )

const styles = Styles.styleSheetCreate({
  video: Styles.platformStyles({
    isElectron: {
      marginBottom: Styles.globalMargins.medium,
      marginTop: Styles.globalMargins.medium,
    },
    isMobile: {
      backgroundColor: Styles.globalColors.blueLighter3,
    },
  }),
})
