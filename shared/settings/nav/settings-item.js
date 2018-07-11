// @flow
import React from 'react'
import type {SettingsItemProps} from './index'
import {Box, Badge, ClickableBox, Text, Icon} from '../../common-adapters'
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
      <Box style={globalStyles.flexBoxRow}>
        <Text
          type={'BodySmallSemibold'}
          style={collapseStyles([
            selected ? styles.selectedText : styles.itemText,
            textColor ? {color: textColor} : {},
          ])}
        >
          {text}
        </Text>
        {!!badgeNumber && badgeNumber > 0 && <Badge badgeStyle={styles.badge} badgeNumber={badgeNumber} />}
      </Box>
    </ClickableBox>
  )
}

const styles = styleSheetCreate({
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
      width: '100%',
      height: 32,
    },
    isMobile: {
      borderBottomColor: globalColors.black_05,
      borderBottomWidth: hairlineWidth,
      height: 56,
    },
  }),
  badge: {
    marginLeft: 4,
    marginRight: 0,
    marginTop: 2,
  },
  itemText: platformStyles({
    isElectron: {
      color: globalColors.black_60,
    },
    isMobile: {
      color: globalColors.black_75,
      position: 'relative',
      top: 3,
    },
  }),
  selectedText: {
    color: globalColors.black_75,
  },
})
