import * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import * as FS from '@/constants/fs'
import {useFsPathItem, useKbfsDaemonStatus} from '../common'
import {useFsBrowserSort} from '../browser/sort-state'

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

const Sort = (ownProps: OwnProps) => {
  const {path} = ownProps
  const pathItem = useFsPathItem(path)
  const {setSortSetting, sortSetting} = useFsBrowserSort(path)
  const kbfsDaemonStatus = useKbfsDaemonStatus()

  const shownSortSetting = FS.showSortSetting(path, pathItem, kbfsDaemonStatus) ? sortSetting : undefined
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    const isRoot = path === FS.defaultPath
    const sortSettings: Array<T.FS.SortSetting> = isRoot
      ? []
      : [T.FS.SortSetting.NameAsc, T.FS.SortSetting.NameDesc, T.FS.SortSetting.TimeAsc, T.FS.SortSetting.TimeDesc]
    return (
      <Kb.FloatingMenu
        attachTo={attachTo}
        visible={true}
        onHidden={hidePopup}
        position="bottom left"
        closeOnSelect={true}
        items={sortSettings.map(s => makeSortOptionItem(s, () => setSortSetting(path, s)))}
      />
    )
  }
  const {showPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return shownSortSetting ? (
    <>
      <Kb.ClickableBox3 onClick={showPopup} ref={popupAnchor} direction="horizontal" gap="xxtiny" centerChildren={isMobile}>
        <Kb.Icon type="iconfont-arrow-full-down" padding="xtiny" sizeType="Small" />
        <Kb.Text type="BodySmallSemibold" style={styles.sortText}>
          {getTextFromSortSetting(shownSortSetting)}
        </Kb.Text>
      </Kb.ClickableBox3>
      {popup}
    </>
  ) : null
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      sortText: Kb.Styles.platformStyles({isElectron: {whiteSpace: 'nowrap'}}),
    }) as const
)

export default Sort
