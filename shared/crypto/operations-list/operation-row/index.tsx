import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Types from '../../../constants/types/crypto'
import * as Styles from '../../../styles'
import {IconType} from '../../../common-adapters/icon.constants-gen'

type Props = {
  title: string
  tab: Types.CryptoSubTab
  icon: IconType
  isSelected: boolean
  onSelect: () => void
}

const OperationRow = (props: Props) => {
  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      className={Styles.classNames({
        background_color_blue: props.isSelected,
        hover_background_color_blueGreyDark: !props.isSelected,
      })}
    >
      <Kb.ListItem2
        type="Small"
        firstItem={true}
        statusIcon={
          <Kb.Icon
            type={Kb.Icon.makeFastType(props.icon)}
            sizeType="Small"
            color={props.isSelected ? Styles.globalColors.whiteOrWhite : ''}
            padding="xtiny"
          />
        }
        onClick={props.onSelect}
        hideHover={true}
        body={
          <Kb.Box2
            direction="vertical"
            fullHeight={true}
            fullWidth={true}
            style={Styles.collapseStyles([styles.textContainer])}
          >
            <Kb.Text
              type="BodySemibold"
              style={{
                color: props.isSelected ? Styles.globalColors.whiteOrWhite : Styles.globalColors.blackOrWhite,
              }}
            >
              {props.title}
            </Kb.Text>
          </Kb.Box2>
        }
      />
    </Kb.Box2>
  )
}

const rowHeight = 50

const styles = Styles.styleSheetCreate(() => ({
  clickableContainer: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.clickable,
      flexShrink: 0,
      height: rowHeight,
      width: '100%',
    },
  }),
  textContainer: {
    justifyContent: 'center',
    marginLeft: Styles.globalMargins.tiny,
  },
}))

export default OperationRow
