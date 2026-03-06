import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'
import {useCurrentUserState} from '@/stores/current-user'

type Props = {
  onRetry: () => void
  bannerType: T.FS.MainBannerType
}

const Banner = (props: Props) => {
  switch (props.bannerType) {
    case T.FS.MainBannerType.None:
      return null
    case T.FS.MainBannerType.Offline:
      return (
        <Kb.Banner color="blue">
          <Kb.BannerParagraph bannerColor="blue" content="You are offline." />
        </Kb.Banner>
      )
    case T.FS.MainBannerType.TryingToConnect:
      return (
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.loadingLineContainer}>
          <Kb.LoadingLine />
        </Kb.Box2>
      )
    case T.FS.MainBannerType.OutOfSpace:
      return (
        <Kb.Banner color="red">
          <Kb.BannerParagraph
            bannerColor="red"
            content={[
              'Your ',
              Kb.Styles.isMobile ? 'phone' : 'computer',
              ' is out of space and some folders could not be properly synced. Make some space and ',
              {onClick: props.onRetry, text: 'retry the sync'},
              '.',
            ]}
          />
        </Kb.Banner>
      )
  }
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  loadingLineContainer: Kb.Styles.platformStyles({
    isElectron: {
      position: 'relative',
      top: -1,
    },
  }),
}))

const ConnectedBanner = () => {
  const {_kbfsDaemonStatus, _overallSyncStatus, loadPathMetadata} = useFSState(
    C.useShallow(s => {
      const _kbfsDaemonStatus = s.kbfsDaemonStatus
      const _overallSyncStatus = s.overallSyncStatus
      const loadPathMetadata = s.dispatch.loadPathMetadata
      return {_kbfsDaemonStatus, _overallSyncStatus, loadPathMetadata}
    })
  )
  const _name = useCurrentUserState(s => s.username)
  // This LoadPathMetadata triggers a sync retry.
  const onRetry = () => {
    loadPathMetadata(T.FS.stringToPath('/keybase/private' + _name))
  }

  const props = {
    bannerType: FS.getMainBannerType(_kbfsDaemonStatus, _overallSyncStatus),
    onRetry,
  }
  return <Banner {...props} />
}

export default ConnectedBanner
