import React from 'react'
import {Badge, ClickableBox, Text, Icon, IconType, ProgressIndicator} from '../../common-adapters'
import * as Styles from '../../styles'

type SettingsItemProps = {
  badgeNumber?: number
  icon?: IconType
  inProgress?: boolean
  largerBadgeMinWidthFix?: boolean
  onClick: () => void
  text: string
  textColor?: Styles.Color
  selected?: boolean
}

export default function SettingsItem(props: SettingsItemProps) {
  return (
    <ClickableBox
      onClick={props.onClick}
      style={Styles.collapseStyles([
        styles.item,
        props.selected
          ? {
              borderLeftColor: Styles.globalColors.blue,
              borderLeftStyle: 'solid',
              borderLeftWidth: 3,
            }
          : {},
      ])}
    >
      {props.icon && (
        <Icon
          type={props.icon}
          color={Styles.globalColors.black_20}
          style={{marginRight: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.tiny}}
        />
      )}
      <Text
        type="BodySemibold"
        style={Styles.collapseStyles([
          props.selected ? styles.selectedText : styles.itemText,
          props.textColor ? {color: props.textColor} : {},
        ])}
      >
        {props.text}
      </Text>
      {props.inProgress && <ProgressIndicator style={styles.progress} />}
      {!!props.badgeNumber && props.badgeNumber > 0 && (
        <Badge badgeNumber={props.badgeNumber} badgeStyle={styles.badge} />
      )}
    </ClickableBox>
  )
}

const styles = Styles.styleSheetCreate({
  badge: {
    marginLeft: 6,
  },
  item: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      position: 'relative',
    },
    isElectron: {
      height: 32,
      width: '100%',
    },
    isMobile: {
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: Styles.hairlineWidth,
      height: 56,
    },
  }),
  itemText: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.black_50,
    },
    isMobile: {
      color: Styles.globalColors.black,
    },
  }),
  progress: {
    marginLeft: 6,
  },
  selectedText: {
    color: Styles.globalColors.black,
  },
})
