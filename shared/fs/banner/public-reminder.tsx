import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import {navigateAppend} from '@/constants/router'
import type {RootRouteProps} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/native'
import {useFSState} from '@/stores/fs'
import * as FS from '@/stores/fs'

type Props = {
  lastClosedTlf?: string
  path: T.FS.Path
}

const getTlfName = (parsedPath: T.FS.ParsedPath): string => {
  if (parsedPath.kind === T.FS.PathKind.Root || parsedPath.kind === T.FS.PathKind.TlfList) {
    return ''
  }
  return parsedPath.tlfName
}

const PublicBanner = (props: Props) => {
  const {path} = props
  const route = useRoute<RootRouteProps<'fsRoot'>>()
  const isWritable = useFSState(s => FS.getPathItem(s.pathItems, path).writable)
  const lastPublicBannerClosedTlf = props.lastClosedTlf ?? ''
  const folderViewFilter = route.params?.folderViewFilter
  const setLastPublicBannerClosedTlf = React.useCallback(
    (tlf: string) =>
      navigateAppend(
        {name: 'fsRoot', params: {folderViewFilter, lastClosedPublicBannerTlf: tlf, path}},
        true
      ),
    [folderViewFilter, path]
  )

  const setLastClosed = () => setLastPublicBannerClosedTlf(tlfName)

  const parsedPath = FS.parsePath(path)
  const tlfName = getTlfName(parsedPath)

  // If we're showing the banner for a new TLF, clear the closed state
  React.useEffect(() => {
    if (lastPublicBannerClosedTlf !== '' && lastPublicBannerClosedTlf !== tlfName) {
      setLastPublicBannerClosedTlf('')
    }
  }, [setLastPublicBannerClosedTlf, tlfName, lastPublicBannerClosedTlf])

  if (parsedPath.kind !== T.FS.PathKind.GroupTlf && parsedPath.kind !== T.FS.PathKind.InGroupTlf) {
    return null
  }

  const isPublic = parsedPath.tlfType === T.FS.TlfType.Public
  const closedThisBannerLast = lastPublicBannerClosedTlf === tlfName

  if (!isWritable || !isPublic || closedThisBannerLast) {
    return null
  }
  return (
    <Kb.Banner color="yellow" onClose={setLastClosed}>
      <Kb.BannerParagraph bannerColor="yellow" content={['Everything you upload here is public.']} />
    </Kb.Banner>
  )
}

export default PublicBanner
