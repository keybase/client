import * as C from '@/constants'
import * as Kb from '@/common-adapters'

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

const LinkError = (props: {error?: string}) => {
  const error = props.error ?? 'Invalid page! (sorry)'
  const message = error
  const isError = true
  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onClose = () => navigateUp()
  return <KeybaseLinkErrorBody onCancel={onClose} isError={isError} message={message} />
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    common: {
      backgroundColor: Kb.Styles.globalColors.white,
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

type OwnProps = C.ViewPropsToPageProps<typeof LinkError>
const Screen = (p: OwnProps) => <LinkError {...p.route.params} />
export default Screen
