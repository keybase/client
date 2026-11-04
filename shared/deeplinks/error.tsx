import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

type KeybaseLinkErrorBodyProps = {
  message: string
  isError: boolean
}

const KeybaseLinkErrorBody = (props: KeybaseLinkErrorBodyProps) => {
  const styles = useStyles()
  const bannerColor = props.isError ? 'red' : 'green'
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} testID={TestIDs.KEYBASE_LINK_ERROR}>
      <Kb.Banner color={bannerColor}>
        <Kb.BannerParagraph bannerColor={bannerColor} content={props.message} selectable={true} />
      </Kb.Banner>
    </Kb.Box2>
  )
}

const LinkError = (props: {error?: string}) => (
  <KeybaseLinkErrorBody isError={true} message={props.error ?? 'Invalid page! (sorry)'} />
)

const useStyles = Kb.Styles.createStyleHook(theme => ({
  container: {
    backgroundColor: theme.white,
    flexGrow: 1,
    flexShrink: 1,
    maxHeight: '100%',
  },
}))

import type {StaticScreenProps} from '@react-navigation/core'
type OwnProps = StaticScreenProps<{error?: string}>
const Screen = (p: OwnProps) => <LinkError {...p.route.params} />
export default Screen
