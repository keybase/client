import * as C from '@/constants'
import * as T from '@/constants/types'
import * as React from 'react'
import * as Kb from '@/common-adapters'
import * as FS from '@/stores/fs'
import {useFSState} from '@/stores/fs'

type OwnProps = {
  path: T.FS.Path
}

const getTextFromSortSetting = (sortSetting: T.FS.SortSetting) => {
  switch (sortSetting) {
    case T.FS.SortSetting.NameAsc:
      return 'Name A to Z'
    case T.FS.SortSetting.NameDesc:
      return 'Name Z to A'
    case T.FS.SortSetting.TimeAsc:
      return 'Recent first'
    case T.FS.SortSetting.TimeDesc:
      return 'Older first'
    default:
      return 'Name A to Z'
  }
}

const makeSortOptionItem = (sortSetting: T.FS.SortSetting, onClick?: () => void) => ({
  onClick,
  title: getTextFromSortSetting(sortSetting),
})

const Container = (ownProps: OwnProps) => {
  const {path} = ownProps
  const {_kbfsDaemonStatus, _pathItem, setSorting, _sortSetting} = useFSState(
    C.useShallow(s => ({
      _kbfsDaemonStatus: s.kbfsDaemonStatus,
      _pathItem: FS.getPathItem(s.pathItems, path),
      _sortSetting: FS.getPathUserSetting(s.pathUserSettings, path).sort,
      setSorting: s.dispatch.setSorting,
    }))
  )

  const sortSetting = FS.showSortSetting(path, _pathItem, _kbfsDaemonStatus) ? _sortSetting : undefined
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      const sortByNameAsc =
        path === FS.defaultPath
          ? undefined
          : () => {
              setSorting(path, T.FS.SortSetting.NameAsc)
            }
      const sortByNameDesc =
        path === FS.defaultPath
          ? undefined
          : () => {
              setSorting(path, T.FS.SortSetting.NameDesc)
            }
      const sortByTimeAsc =
        path === FS.defaultPath
          ? undefined
          : () => {
              setSorting(path, T.FS.SortSetting.TimeAsc)
            }
      const sortByTimeDesc =
        path === FS.defaultPath
          ? undefined
          : () => {
              setSorting(path, T.FS.SortSetting.TimeDesc)
            }
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          visible={true}
          onHidden={hidePopup}
          position="bottom left"
          closeOnSelect={true}
          items={[
            ...(sortByNameAsc ? [makeSortOptionItem(T.FS.SortSetting.NameAsc, sortByNameAsc)] : []),
            ...(sortByNameDesc ? [makeSortOptionItem(T.FS.SortSetting.NameDesc, sortByNameDesc)] : []),
            ...(sortByTimeAsc ? [makeSortOptionItem(T.FS.SortSetting.TimeAsc, sortByTimeAsc)] : []),
            ...(sortByTimeDesc ? [makeSortOptionItem(T.FS.SortSetting.TimeDesc, sortByTimeDesc)] : []),
          ]}
        />
      )
    },
    [setSorting, path]
  )
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return sortSetting ? (
    <>
      <Kb.ClickableBox onClick={showPopup} ref={popupAnchor}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xxtiny" centerChildren={Kb.Styles.isMobile}>
          <Kb.Icon type="iconfont-arrow-full-down" padding="xtiny" sizeType="Small" />
          <Kb.Text type="BodySmallSemibold">{getTextFromSortSetting(sortSetting)}</Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
      {popup}
    </>
  ) : null
}

export default Container
