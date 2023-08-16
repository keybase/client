import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as T from '../../constants/types'

export type SortBarProps = {
  sortByNameAsc?: () => void
  sortByNameDesc?: () => void
  sortByTimeAsc?: () => void
  sortByTimeDesc?: () => void
  sortSetting?: T.FS.SortSetting
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

const Sort = (props: SortBarProps) => {
  const {sortSetting, sortByNameAsc, sortByNameDesc, sortByTimeAsc, sortByTimeDesc} = props
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, toggleShowingPopup} = p
      return (
        <Kb.FloatingMenu
          attachTo={attachTo}
          visible={true}
          onHidden={toggleShowingPopup}
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
    [sortByNameAsc, sortByNameDesc, sortByTimeAsc, sortByTimeDesc]
  )
  const {toggleShowingPopup, popup, popupAnchor} = Kb.usePopup2(makePopup)
  return sortSetting ? (
    <>
      <Kb.ClickableBox onClick={toggleShowingPopup} ref={popupAnchor}>
        <Kb.Box2 direction="horizontal" fullWidth={true} gap="xxtiny" centerChildren={Styles.isMobile}>
          <Kb.Icon type="iconfont-arrow-full-down" padding="xtiny" sizeType="Small" />
          <Kb.Text type="BodySmallSemibold">{getTextFromSortSetting(sortSetting)}</Kb.Text>
        </Kb.Box2>
      </Kb.ClickableBox>
      {popup}
    </>
  ) : null
}

export default Sort
