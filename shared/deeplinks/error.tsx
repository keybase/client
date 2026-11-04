import * as Kb from '@/common-adapters'
import * as TestIDs from '@/tests/e2e/shared/test-ids'

const LinkError = (props: {error?: string}) => {
  const styles = useStyles()
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container} testID={TestIDs.KEYBASE_LINK_ERROR}>
      <Kb.Banner color="red">
        <Kb.BannerParagraph bannerColor="red" content={props.error ?? 'Invalid page! (sorry)'} selectable={true} />
      </Kb.Banner>
    </Kb.Box2>
  )
}

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
