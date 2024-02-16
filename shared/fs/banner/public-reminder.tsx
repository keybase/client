import * as C from '@/constants'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'

type Props = {
  path: T.FS.Path
}

const getTlfName = (parsedPath: T.FS.ParsedPath): string => {
  if (parsedPath.kind === T.FS.PathKind.Root || parsedPath.kind === T.FS.PathKind.TlfList) {
    return ''
  }
  return parsedPath.tlfName
}

const PublicBanner = ({path}: Props) => {
  const isWritable = C.useFSState(s => C.FS.getPathItem(s.pathItems, path).writable)
  const lastPublicBannerClosedTlf = C.useFSState(s => s.lastPublicBannerClosedTlf)
  const setLastPublicBannerClosedTlf = C.useFSState(s => s.dispatch.setLastPublicBannerClosedTlf)

  const setLastClosed = () => setLastPublicBannerClosedTlf(tlfName)

  const parsedPath = C.FS.parsePath(path)
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
