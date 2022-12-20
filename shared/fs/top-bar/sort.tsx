import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'

export type SortBarProps = {
  sortByNameAsc?: () => void
  sortByNameDesc?: () => void
  sortByTimeAsc?: () => void
  sortByTimeDesc?: () => void
  sortSetting?: Types.SortSetting
}

const getTextFromSortSetting = (sortSetting: Types.SortSetting) => {
  switch (sortSetting) {
    case Types.SortSetting.NameAsc:
      return 'Name A to Z'
    case Types.SortSetting.NameDesc:
      return 'Name Z to A'
    case Types.SortSetting.TimeAsc:
      return 'Recent first'
    case Types.SortSetting.TimeDesc:
      return 'Older first'
    default:
      return 'Name A to Z'
  }
}

const makeSortOptionItem = (sortSetting: Types.SortSetting, onClick?: () => void) => ({
  onClick,
  title: getTextFromSortSetting(sortSetting),
})

const Sort = (props: SortBarProps) => {
  const {sortSetting} = props
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo => (
    <Kb.FloatingMenu
      attachTo={attachTo}
      visible={showingPopup}
      onHidden={toggleShowingPopup}
      position="bottom left"
      closeOnSelect={true}
      items={[
        ...(props.sortByNameAsc ? [makeSortOptionItem(Types.SortSetting.NameAsc, props.sortByNameAsc)] : []),
        ...(props.sortByNameDesc
          ? [makeSortOptionItem(Types.SortSetting.NameDesc, props.sortByNameDesc)]
          : []),
        ...(props.sortByTimeAsc ? [makeSortOptionItem(Types.SortSetting.TimeAsc, props.sortByTimeAsc)] : []),
        ...(props.sortByTimeDesc
          ? [makeSortOptionItem(Types.SortSetting.TimeDesc, props.sortByTimeDesc)]
          : []),
      ]}
    />
  ))
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
