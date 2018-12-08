// @flow
import React from 'react'
import type {SettingsItemProps} from './index'
import {Badge, ClickableBox, Text, Icon} from '../../common-adapters'
import * as Style from '../../styles'

export default function SettingsItem(props: SettingsItemProps) {
  return (
    <ClickableBox
      onClick={props.onClick}
      style={Style.collapseStyles([
        styles.item,
        props.selected
          ? {
              borderLeftColor: Style.globalColors.blue,
              borderLeftStyle: 'solid',
              borderLeftWidth: 3,
            }
          : {},
      ])}
    >
      {props.icon && (
        <Icon
          type={props.icon}
          color={Style.globalColors.black_20}
          style={{marginRight: Style.globalMargins.small}}
        />
      )}
      <Text
        type="BodySemibold"
        style={Style.collapseStyles([
          props.selected ? styles.selectedText : styles.itemText,
          props.textColor ? {color: props.textColor} : {},
        ])}
      >
        {props.text}
      </Text>
      {!!props.badgeNumber && props.badgeNumber > 0 && (
        <Badge badgeNumber={props.badgeNumber} badgeStyle={styles.badge} />
      )}
    </ClickableBox>
  )
}

const styles = Style.styleSheetCreate({
  badge: {
    marginLeft: 6,
  },
  item: Style.platformStyles({
    common: {
      ...Style.globalStyles.flexBoxRow,
      alignItems: 'center',
      paddingLeft: Style.globalMargins.small,
      paddingRight: Style.globalMargins.small,
      position: 'relative',
    },
    isElectron: {
      height: 32,
      textTransform: 'uppercase',
      width: '100%',
    },
    isMobile: {
      borderBottomColor: Style.globalColors.black_10,
      borderBottomWidth: Style.hairlineWidth,
      height: 56,
    },
  }),
  itemText: Style.platformStyles({
    isElectron: {
      color: Style.globalColors.black_60,
    },
    isMobile: {
      color: Style.globalColors.black_75,
    },
  }),
  selectedText: {
    color: Style.globalColors.black_75,
  },
})
