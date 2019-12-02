import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import Footer from '../footer/footer'
import View from './view'
import * as Kbfs from '../common'

type Props = {
  onBack: () => void
  path: Types.Path
}

const BarePreview = (props: Props) => {
  const [loading, setLoading] = React.useState(false)
  const onLoadingStateChange = (l: boolean) => setLoading(l)
  const onUrlError = Kbfs.useFsFileContext(props.path)
  return (
    <Kb.Box style={styles.container}>
      <Kb.Box style={styles.header}>
        <Kb.ClickableBox onClick={props.onBack} style={styles.closeBox}>
          <Kb.Text type="Body" style={styles.text}>
            Close
          </Kb.Text>
        </Kb.ClickableBox>
      </Kb.Box>
      <Kb.Box style={styles.contentContainer}>
        <View path={props.path} onLoadingStateChange={onLoadingStateChange} onUrlError={onUrlError} />
      </Kb.Box>
      <Kb.Box style={styles.footer}>
        <Kbfs.PathItemAction
          path={props.path}
          clickable={{actionIconWhite: true, type: 'icon'}}
          initView={Types.PathItemActionMenuView.Root}
          mode="screen"
        />
      </Kb.Box>
      <Footer path={props.path} onlyShowProofBroken={true} />
      {loading && <Kb.ProgressIndicator style={styles.loading} white={true} />}
    </Kb.Box>
  )
}

export default BarePreview

const styles = Styles.styleSheetCreate(
  () =>
    ({
      closeBox: {
        height: 48,
        paddingLeft: Styles.globalMargins.tiny,
        width: 64,
      },
      container: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxColumn,
          ...Styles.globalStyles.flexGrow,
          backgroundColor: Styles.globalColors.blackOrBlack,
        },
      }),
      contentContainer: {
        ...Styles.globalStyles.flexGrow,
      },
      footer: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        height: 48,
        paddingLeft: Styles.globalMargins.tiny,
      },
      header: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        paddingLeft: Styles.globalMargins.tiny,
      },
      loading: Styles.platformStyles({
        common: {
          height: 32,
          width: 32,
        },
        isMobile: {
          left: Styles.globalMargins.small,
          position: 'absolute',
          top: 48,
        },
      }),
      text: {
        color: Styles.globalColors.whiteOrBlueDark,
        lineHeight: 48,
      },
    } as const)
)
