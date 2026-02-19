import * as Kb from '@/common-adapters'
import type {IconType} from '@/common-adapters/icon.constants-gen'

type Props = {
  title: string
  tab: string
  // Desktop only
  icon?: IconType
  isSelected?: boolean
  // Moible only
  description?: string
  illustration?: IconType
  onClick: () => void
}

const NavRow = (props: Props) => {
  const {isSelected, title, icon, illustration, description, onClick} = props

  const desktopRow = icon ? (
    <Kb.Box2
      direction="horizontal"
      fullWidth={true}
      className={Kb.Styles.classNames({
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
            color={isSelected ? Kb.Styles.globalColors.whiteOrWhite : ''}
            padding="xtiny"
          />
        }
        onClick={onClick}
        hideHover={true}
        body={
          <Kb.Box2
            direction="vertical"
            fullHeight={true}
            fullWidth={true}
            style={Kb.Styles.collapseStyles([styles.textContainer])}
          >
            <Kb.Text3
              type="BodySemibold"
              style={{
                color: isSelected ? Kb.Styles.globalColors.whiteOrWhite : Kb.Styles.globalColors.blackOrWhite,
              }}
            >
              {title}
            </Kb.Text3>
          </Kb.Box2>
        }
      />
    </Kb.Box2>
  ) : null

  const mobileRow =
    description && illustration ? (
      <Kb.RichButton title={title} description={description} icon={illustration} onClick={onClick} />
    ) : null

  return Kb.Styles.isMobile ? mobileRow : desktopRow
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  textContainer: {
    justifyContent: 'center',
    marginLeft: Kb.Styles.globalMargins.tiny,
  },
}))

export default NavRow
