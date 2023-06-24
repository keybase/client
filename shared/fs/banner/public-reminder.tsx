import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as ConfigConstants from '../../constants/config'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import openUrl from '../../util/open-url'
import * as Container from '../../util/container'

type Props = {
  path: Types.Path
}

const getTlfName = (parsedPath: Types.ParsedPath): string => {
  if (parsedPath.kind === Types.PathKind.Root || parsedPath.kind === Types.PathKind.TlfList) {
    return ''
  }
  return parsedPath.tlfName
}

const PublicBanner = ({path}: Props) => {
  const isWritable = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, path).writable)
  const lastPublicBannerClosedTlf = Constants.useState(s => s.lastPublicBannerClosedTlf)
  const you = ConfigConstants.useCurrentUserState(s => s.username)

  const setLastPublicBannerClosedTlf = Constants.useState(s => s.dispatch.setLastPublicBannerClosedTlf)

  const setLastClosed = () => setLastPublicBannerClosedTlf(tlfName)

  const parsedPath = Constants.parsePath(path)
  const tlfName = getTlfName(parsedPath)

  // If we're showing the banner for a new TLF, clear the closed state
  React.useEffect(() => {
    if (lastPublicBannerClosedTlf !== '' && lastPublicBannerClosedTlf !== tlfName) {
      setLastPublicBannerClosedTlf('')
    }
  }, [setLastPublicBannerClosedTlf, tlfName, lastPublicBannerClosedTlf])

  if (parsedPath.kind !== Types.PathKind.GroupTlf && parsedPath.kind !== Types.PathKind.InGroupTlf) {
    return null
  }

  const isPublic = parsedPath.tlfType === Types.TlfType.Public
  const closedThisBannerLast = lastPublicBannerClosedTlf === tlfName

  if (!isWritable || !isPublic || closedThisBannerLast) {
    return null
  }
  const url = `https://keybase.pub/${parsedPath.tlfName}`
  return (
    <Kb.Banner color="yellow" onClose={setLastClosed}>
      <Kb.BannerParagraph
        bannerColor="yellow"
        content={
          // keybase.pub only supports simple TLFs
          tlfName === you
            ? [
                'Everything you upload in here can be viewed by everyone at ',
                {onClick: () => openUrl(url), text: url},
                '.',
              ]
            : ['Everything you upload here is public.']
        }
      />
    </Kb.Banner>
  )
}

export default PublicBanner
