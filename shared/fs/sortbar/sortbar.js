// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import {
  Box,
  ClickableBox,
  Text,
  Icon,
  iconCastPlatformStyles,
  FloatingMenu,
  OverlayParentHOC,
  type OverlayParentProps,
} from '../../common-adapters'
import * as Types from '../../constants/types/fs'

export type SortBarProps = {
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
        <Box style={styles.sortSetting}>
          <Box>
            <Icon
              type={sortSettingIconType}
              style={iconCastPlatformStyles(styles.icon)}
              color={Styles.isMobile ? Styles.globalColors.blue : Styles.globalColors.black_75}
              fontSize={Styles.isMobile ? 17 : 13}
            />
          </Box>
          <Text type={Styles.isMobile ? 'BodyBig' : 'Body'} style={styles.text}>
            {sortSettingText}
          </Text>
        </Box>
      ),
    }
  })

const SortBar = (props: SortBarProps & OverlayParentProps) => {
  const {sortSettingIconType, sortSettingText} = Types.sortSettingToIconTypeAndText(props.sortSetting)
  return (
    <Box>
      <Box style={styles.sortBar}>
        <ClickableBox
          onClick={props.toggleShowingMenu}
          style={styles.sortSetting}
          ref={props.setAttachmentRef}
        >
          <Box>
            <Icon type={sortSettingIconType} style={iconCastPlatformStyles(styles.icon)} fontSize={11} />
          </Box>
          <Text type="BodySmallSemibold">{sortSettingText}</Text>
        </ClickableBox>
        <FloatingMenu
          attachTo={props.getAttachmentRef}
          visible={props.showingMenu}
          onHidden={props.toggleShowingMenu}
          position="bottom left"
          closeOnSelect={true}
          items={getPopupItems(props.sortSettingToAction)}
        />
        {props.folderIsPending ? (
          <Box style={styles.loading}>
            <Text type="BodySmall"> Loading ... </Text>
          </Box>
        ) : null}
      </Box>
    </Box>
  )
}

const styles = Styles.styleSheetCreate({
  icon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  loading: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    marginLeft: 'auto',
    marginRight: 32,
  },
  sortBar: {
    ...Styles.globalStyles.flexBoxRow,
    backgroundColor: Styles.globalColors.blue5,
    paddingLeft: 16,
  },
  sortSetting: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: Styles.isMobile ? 32 : 24,
  },
  text: Styles.platformStyles({
    isMobile: {
      color: Styles.globalColors.blue,
    },
  }),
})

export default OverlayParentHOC(SortBar)
