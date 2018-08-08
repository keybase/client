// @flow
import * as React from 'react'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import {
  Box,
  ClickableBox,
  Divider,
  Text,
  Icon,
  FloatingMenu,
  OverlayParentHOC,
  type OverlayParentProps,
} from '../../common-adapters'
import * as Types from '../../constants/types/fs'

export type SortBarProps = {
  folderIsPending: boolean,
  sortSetting: Types._SortSetting,
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
          <Box style={styles.iconBox}>
            <Icon
              type={sortSettingIconType}
              style={styles.icon}
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
      <Divider />
      <Box style={styles.sortBar}>
        <ClickableBox onClick={props.toggleShowingMenu} style={styles.sortSetting}>
          <Box style={styles.iconBox}>
            <Icon type={sortSettingIconType} style={styles.icon} fontSize={11} />
          </Box>
          <Text type="BodySmallSemibold">{sortSettingText}</Text>
        </ClickableBox>
        <FloatingMenu
          containerStyle={styles.popup}
          attachTo={props.attachmentRef}
          visible={props.showingMenu}
          onHidden={props.toggleShowingMenu}
          position="bottom right"
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

// TODO Styles.styleSheetCreate doesn't work with icon
const styles = {
  popup: Styles.platformStyles({
    isMobile: {
      width: '100%',
    },
    isElectron: {
      position: 'absolute',
      left: 88,
      top: 80,
    },
  }),
  sortBar: {
    ...Styles.globalStyles.flexBoxRow,
    backgroundColor: Styles.globalColors.blue5,
    borderTopColor: Styles.globalColors.black_05,
    borderTopWidth: 1,
    paddingLeft: 16,
  },
  sortSetting: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: Styles.isMobile ? 32 : 24,
  },
  icon: {
    marginRight: Styles.globalMargins.xtiny,
  },
  iconBox: {
    marginTop: 4,
  },
  loading: {
    ...Styles.globalStyles.flexBoxRow,
    marginLeft: 'auto',
    marginRight: 32,
    alignItems: 'center',
  },
  text: Styles.platformStyles({
    isMobile: {
      color: Styles.globalColors.blue,
    },
  }),
}

export default OverlayParentHOC(SortBar)
