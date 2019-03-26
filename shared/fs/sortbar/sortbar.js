// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'

export type SortBarProps = {
  canSort: boolean,
  folderIsPending: boolean,
  sortSetting: Types.SortSetting,
  sortSettingToAction: Types.SortSetting => () => void,
}

const sortSettings: Array<Types.SortSetting> = [
  Constants.makeSortSetting({sortBy: 'name', sortOrder: 'asc'}),
  Constants.makeSortSetting({sortBy: 'name', sortOrder: 'desc'}),
  Constants.makeSortSetting({sortBy: 'time', sortOrder: 'asc'}),
  Constants.makeSortSetting({sortBy: 'time', sortOrder: 'desc'}),
]

const getPopupItems = sortSettingToAction =>
  sortSettings.map(sortSetting => {
    const {sortSettingIconType, sortSettingText} = Types.sortSettingToIconTypeAndText(sortSetting)
    return {
      onClick: sortSettingToAction(sortSetting),
      title: sortSettingText,
      view: (
        <Kb.Box style={styles.sortSetting}>
          <Kb.Icon
            type={sortSettingIconType}
            padding="xtiny"
            color={Styles.isMobile ? Styles.globalColors.blue : Styles.globalColors.black}
            fontSize={Styles.isMobile ? 17 : 13}
          />
          <Kb.Text type={Styles.isMobile ? 'BodyBig' : 'Body'} style={styles.text}>
            {sortSettingText}
          </Kb.Text>
        </Kb.Box>
      ),
    }
  })

const SortBar = (props: SortBarProps & Kb.OverlayParentProps) => {
  const {sortSettingIconType, sortSettingText} = Types.sortSettingToIconTypeAndText(props.sortSetting)
  return (
    <Kb.Box2
      direction="horizontal"
      style={styles.sortBar}
      gap="small"
      gapStart={true}
      gapEnd={true}
      centerChildren={true}
    >
      {props.folderIsPending && <Kb.ProgressIndicator type="Small" />}
      <Kb.Box style={styles.flex} />
      {props.canSort && (
        <>
          <Kb.ClickableBox
            onClick={props.toggleShowingMenu}
            style={styles.sortSetting}
            ref={props.setAttachmentRef}
          >
            <Kb.Icon type={sortSettingIconType} padding="xtiny" fontSize={11} />
            <Kb.Text type="BodySmallSemibold">{sortSettingText}</Kb.Text>
          </Kb.ClickableBox>
          <Kb.FloatingMenu
            attachTo={props.getAttachmentRef}
            visible={props.showingMenu}
            onHidden={props.toggleShowingMenu}
            position="bottom left"
            closeOnSelect={true}
            items={getPopupItems(props.sortSettingToAction)}
          />
        </>
      )}
    </Kb.Box2>
  )
}

export const height = Styles.isMobile ? 40 : 32

const styles = Styles.styleSheetCreate({
  flex: {flex: 1},
  sortBar: {
    backgroundColor: Styles.globalColors.blue5,
    height,
  },
  sortSetting: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height,
    justifyContent: 'flex-start',
    minHeight: height,
  },
  text: Styles.platformStyles({
    isMobile: {
      color: Styles.globalColors.blue,
    },
  }),
})

export default Kb.OverlayParentHOC(SortBar)
