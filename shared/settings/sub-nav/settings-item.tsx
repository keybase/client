import * as React from 'react'
import * as Kb from '@/common-adapters'

type SettingsItemProps = {
  badgeNumber?: number
  icon?: Kb.IconType
  iconComponent?: React.ComponentType
  inProgress?: boolean
  largerBadgeMinWidthFix?: boolean
  onClick: () => void
  text: string
  subText?: string
  textColor?: Kb.Styles.Color
  selected?: boolean
}

export default function SettingsItem(props: SettingsItemProps) {
  return (
    <Kb.ClickableBox
      onClick={props.onClick}
      style={Kb.Styles.collapseStyles([styles.item, props.selected && styles.selected] as const)}
    >
      {props.iconComponent ? (
        <props.iconComponent />
      ) : props.icon ? (
        <Kb.Icon
          fontSize={24}
          type={props.icon}
          color={Kb.Styles.globalColors.black_50}
          style={{
            marginRight: Kb.Styles.isMobile ? Kb.Styles.globalMargins.small : Kb.Styles.globalMargins.tiny,
          }}
        />
      ) : null}
      <Kb.Box2 direction="vertical">
        <Kb.Text2
          type="BodySemibold"
          style={Kb.Styles.collapseStyles([
            props.selected ? styles.selectedText : styles.itemText,
            props.textColor ? {color: props.textColor} : {},
          ])}
        >
          {props.text}
        </Kb.Text2>
        {props.text && props.subText && <Kb.Text2 type="BodySmall">{props.subText}</Kb.Text2>}
      </Kb.Box2>
      {props.inProgress && <Kb.ProgressIndicator style={styles.progress} />}
      {!!props.badgeNumber && props.badgeNumber > 0 && (
        <Kb.Badge badgeNumber={props.badgeNumber} badgeStyle={styles.badge} />
      )}
    </Kb.ClickableBox>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  badge: {
    marginLeft: 6,
  },
  item: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      paddingLeft: Kb.Styles.globalMargins.small,
      paddingRight: Kb.Styles.globalMargins.small,
      position: 'relative',
    },
    isElectron: {
      height: 32,
      width: '100%',
    },
    isMobile: {
      borderBottomColor: Kb.Styles.globalColors.black_10,
      borderBottomWidth: Kb.Styles.hairlineWidth,
      height: 56,
    },
  }),
  itemText: Kb.Styles.platformStyles({
    isElectron: {
      color: Kb.Styles.globalColors.black_50,
    },
    isMobile: {
      color: Kb.Styles.globalColors.black,
    },
  }),
  progress: {
    marginLeft: 6,
  },
  selected: Kb.Styles.platformStyles({
    common: {
      borderLeftColor: Kb.Styles.globalColors.blue,
      borderLeftWidth: 3,
      borderStyle: 'solid',
    },
    isTablet: {
      borderRadius: 0,
    },
  }),
  selectedText: {
    color: Kb.Styles.globalColors.black,
  },
}))
