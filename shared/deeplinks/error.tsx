import * as RouterConstants from '../constants/router2'
import {useDeepLinksState} from '../constants'
import * as Kb from '../common-adapters'
import * as Styles from '../styles'

type KeybaseLinkErrorBodyProps = {
  message: string
  isError: boolean
  onCancel?: () => void
}

export const KeybaseLinkErrorBody = (props: KeybaseLinkErrorBodyProps) => {
  const bannerColor = props.isError ? 'red' : 'green'
  return (
    <Kb.PopupWrapper onCancel={props.onCancel} customCancelText="Close">
      <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
        <Kb.Banner color={bannerColor}>
          <Kb.BannerParagraph bannerColor={bannerColor} content={props.message} selectable={true} />
        </Kb.Banner>
      </Kb.Box2>
    </Kb.PopupWrapper>
  )
}

const KeybaseLinkError = () => {
  const deepError = useDeepLinksState(s => s.keybaseLinkError)
  const message = deepError
  const isError = true
  const navigateUp = RouterConstants.useState(s => s.dispatch.navigateUp)
  const onClose = () => navigateUp()
  return <KeybaseLinkErrorBody onCancel={onClose} isError={isError} message={message} />
}

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
    },
    isElectron: {
      height: 560,
      width: 400,
    },
    isMobile: {
      flexGrow: 1,
      flexShrink: 1,
      maxHeight: '100%',
      width: '100%',
    },
  }),
}))

export default KeybaseLinkError
