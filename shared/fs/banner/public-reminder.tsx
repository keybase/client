import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import openUrl from '../../util/open-url'
import * as FsGen from '../../actions/fs-gen'
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
  const lastPublicBannerClosedTlf = Container.useSelector(state => state.fs.lastPublicBannerClosedTlf)
  const you = Container.useSelector(state => state.config.username)

  const dispatch = Container.useDispatch()
  const setLastClosed = () => dispatch(FsGen.createSetLastPublicBannerClosedTlf({tlf: tlfName}))

  const parsedPath = Constants.parsePath(path)
  const tlfName = getTlfName(parsedPath)

  // If we're showing the banner for a new TLF, clear the closed state
  React.useEffect(() => {
    if (lastPublicBannerClosedTlf !== '' && lastPublicBannerClosedTlf !== tlfName) {
      dispatch(FsGen.createSetLastPublicBannerClosedTlf({tlf: ''}))
    }
  }, [dispatch, tlfName, lastPublicBannerClosedTlf])

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
