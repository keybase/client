// @flow
import React from 'react'
import type {SettingsItemProps} from './index'
import {Badge2, ClickableBox, Text, Icon} from '../../common-adapters'
import {
  platformStyles,
  globalStyles,
  globalColors,
  globalMargins,
  styleSheetCreate,
  hairlineWidth,
  collapseStyles,
} from '../../styles'

export default function SettingsItem({
  badgeNumber,
  icon,
  largerBadgeMinWidthFix,
  onClick,
  text,
  textColor,
  selected,
}: SettingsItemProps) {
  return (
    <ClickableBox
      onClick={onClick}
      style={collapseStyles([
        styles.item,
        selected
          ? {
              borderLeftColor: globalColors.blue,
              borderLeftStyle: 'solid',
              borderLeftWidth: 3,
            }
          : {},
      ])}
    >
      {icon && <Icon type={icon} color={globalColors.black_20} style={{marginRight: globalMargins.small}} />}
      <Text
        type={'BodySmallSemibold'}
        style={collapseStyles([
          selected ? styles.selectedText : styles.itemText,
          textColor ? {color: textColor} : {},
        ])}
      >
        {text}
      </Text>
      {!!badgeNumber &&
        badgeNumber > 0 && (
          <Badge2 badgeNumber={badgeNumber} fontSize={12} height={20} badgeStyle={styles.badge} />
        )}
    </ClickableBox>
  )
}

const styles = styleSheetCreate({
  badge: {
    marginLeft: 6,
  },
  item: platformStyles({
    common: {
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
      paddingLeft: globalMargins.small,
      paddingRight: globalMargins.small,
      position: 'relative',
    },
    isElectron: {
      textTransform: 'uppercase',
      height: 32,
      width: '100%',
    },
    isMobile: {
      borderBottomColor: globalColors.black_05,
      borderBottomWidth: hairlineWidth,
      height: 56,
    },
  }),
  itemText: platformStyles({
    isElectron: {
      color: globalColors.black_60,
    },
    isMobile: {
      color: globalColors.black_75,
    },
  }),
  selectedText: {
    color: globalColors.black_75,
  },
})
