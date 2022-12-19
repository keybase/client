import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type SettingsItemProps = {
  badgeNumber?: number
  icon?: Kb.IconType
  iconComponent?: React.ComponentType
  inProgress?: boolean
  largerBadgeMinWidthFix?: boolean
  onClick: () => void
  text: string
  subText?: string
  textColor?: Styles.Color
  selected?: boolean
}

export default function SettingsItem(props: SettingsItemProps) {
  return (
    <Kb.ClickableBox
      onClick={props.onClick}
      style={Styles.collapseStyles([styles.item, props.selected && styles.selected] as const)}
    >
      {props.iconComponent ? (
        <props.iconComponent />
      ) : props.icon ? (
        <Kb.Icon
          fontSize={24}
          type={props.icon}
          color={Styles.globalColors.black_50}
          style={{marginRight: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.tiny}}
        />
      ) : null}
      <Kb.Box2 direction="vertical">
        <Kb.Text
          type="BodySemibold"
          style={Styles.collapseStyles([
            props.selected ? styles.selectedText : styles.itemText,
            props.textColor ? {color: props.textColor} : {},
          ])}
        >
          {props.text}
        </Kb.Text>
        {props.text && props.subText && <Kb.Text type="BodySmall">{props.subText}</Kb.Text>}
      </Kb.Box2>
      {props.inProgress && <Kb.ProgressIndicator style={styles.progress} />}
      {!!props.badgeNumber && props.badgeNumber > 0 && (
        <Kb.Badge badgeNumber={props.badgeNumber} badgeStyle={styles.badge} />
      )}
    </Kb.ClickableBox>
  )
}

const styles = Styles.styleSheetCreate(() => ({
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
  selected: Styles.platformStyles({
    common: {
      borderLeftColor: Styles.globalColors.blue,
      borderLeftWidth: 3,
      borderStyle: 'solid',
    },
    isTablet: {
      borderRadius: 0,
    },
  }),
  selectedText: {
    color: Styles.globalColors.black,
  },
}))
