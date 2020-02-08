import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import * as Container from '../../util/container'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/crypto'
import * as Styles from '../../styles'
import {IconType} from '../../common-adapters/icon.constants-gen'

type Props = {
  title: string
  tab: Types.CryptoSubTab
  icon: IconType
  isSelected: boolean
}

const OperationRow = (props: Props) => {
  const {tab, isSelected, title, icon} = props
  const dispatch = Container.useDispatch()

  const onSelect = () => {
    dispatch(RouteTreeGen.createNavigateAppend({path: [tab], replace: true}))
  }

  return (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      className={Styles.classNames({
        background_color_blue: isSelected,
        hover_background_color_blueGreyDark: !isSelected,
      })}
    >
      <Kb.ListItem2
        type="Small"
        firstItem={true}
        statusIcon={
          <Kb.Icon
            type={icon}
            sizeType="Small"
            color={isSelected ? Styles.globalColors.whiteOrWhite : ''}
            padding="xtiny"
          />
        }
        onClick={onSelect}
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
                color: isSelected ? Styles.globalColors.whiteOrWhite : Styles.globalColors.blackOrWhite,
              }}
            >
              {title}
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
