// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as Flow from '../../util/flow'

export type SortBarProps = {|
  sortByNameAsc?: ?() => void,
  sortByNameDesc?: ?() => void,
  sortByTimeAsc?: ?() => void,
  sortByTimeDesc?: ?() => void,
  sortSetting?: ?Types.SortSetting,
|}

const getTextFromSortSetting = (sortSetting: Types.SortSetting) => {
  switch (sortSetting) {
    case 'name-asc':
      return 'Name A to Z'
    case 'name-desc':
      return 'Name Z to A'
    case 'time-asc':
      return 'Recent first'
    case 'time-desc':
      return 'Older first'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(sortSetting)
      return 'Name A to Z'
  }
}

const getIconFromSortSetting = (sortSetting: Types.SortSetting) => {
  switch (sortSetting) {
    case 'name-asc':
      return 'iconfont-arrow-full-down'
    case 'name-desc':
      return 'iconfont-arrow-full-up'
    case 'time-asc':
      return 'iconfont-time'
    case 'time-desc':
      return 'iconfont-time-reversed'
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(sortSetting)
      return 'iconfont-arrow-full-down'
  }
}

const SortOption = ({mode, sortSetting}) => (
  <Kb.Box2
    direction="horizontal"
    fullWidth={true}
    gap={mode === 'menu' ? 'xtiny' : 'xxtiny'}
    centerChildren={Styles.isMobile}
  >
    <Kb.Icon
      type={getIconFromSortSetting(sortSetting)}
      padding="xtiny"
      color={mode === 'menu' && Styles.isMobile ? Styles.globalColors.blue : undefined}
      sizeType={mode === 'bar' ? 'Small' : 'Default'}
    />
    <Kb.Box2 direction="vertical" fullHeight={true} centerChildren={true}>
      <Kb.Text
        type={mode === 'bar' ? 'BodySmallSemibold' : Styles.isMobile ? 'BodyBig' : 'Body'}
        style={mode === 'menu' ? styles.blueMobile : undefined}
      >
        {getTextFromSortSetting(sortSetting)}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

const makeSortOptionItem = (sortSetting, onClick) => ({
  onClick,
  title: getTextFromSortSetting(sortSetting),
  view: <SortOption mode="menu" sortSetting={sortSetting} />,
})

const Sort = (props: SortBarProps & Kb.OverlayParentProps) =>
  !!props.sortSetting && (
    <>
      <Kb.ClickableBox onClick={props.toggleShowingMenu} ref={props.setAttachmentRef}>
        <SortOption mode="bar" sortSetting={props.sortSetting} />
      </Kb.ClickableBox>
      <Kb.FloatingMenu
        attachTo={props.getAttachmentRef}
        visible={props.showingMenu}
        onHidden={props.toggleShowingMenu}
        position="bottom right"
        closeOnSelect={true}
        items={[
          ...(props.sortByNameAsc ? [makeSortOptionItem('name-asc', props.sortByNameAsc)] : []),
          ...(props.sortByNameDesc ? [makeSortOptionItem('name-desc', props.sortByNameDesc)] : []),
          ...(props.sortByTimeAsc ? [makeSortOptionItem('time-asc', props.sortByTimeAsc)] : []),
          ...(props.sortByTimeDesc ? [makeSortOptionItem('time-desc', props.sortByTimeDesc)] : []),
        ]}
      />
    </>
  )

const styles = Styles.styleSheetCreate({
  blueMobile: Styles.platformStyles({
    isMobile: {
      color: Styles.globalColors.blue,
    },
  }),
})

export default Kb.OverlayParentHOC(Sort)
