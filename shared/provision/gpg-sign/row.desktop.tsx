import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

import './row.css'

type Props = {
  onClick: () => void
  icon: Kb.IconType
  title: string
  subTitle?: string
  style?: Object
  children?: any
}

const Row = ({onClick, icon, title, subTitle, children, style}: Props) => {
  return (
    <div
      className="register-row"
      style={Styles.collapseStyles([Styles.desktopStyles.clickable, styles.rowContainer, style])}
      onClick={onClick}
    >
      <div style={styles.iconContainer}>
        <div className="register-background" style={styles.iconBackground as any} />
        <Kb.Icon
          className="register-icon"
          type={icon}
          style={styles.icon}
          color={Styles.globalColors.black}
          fontSize={35}
        />
      </div>
      <div>
        <Kb.Text type="Header" style={styles.header}>
          {title}
        </Kb.Text>
        <Kb.Text type="BodySmall">{subTitle}</Kb.Text>
        {children}
      </div>
    </div>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      header: {
        color: Styles.globalColors.blueDark,
      },
      icon: Styles.platformStyles({
        common: {
          height: 'inherit',
          textAlign: 'center',
          width: 'inherit',
          zIndex: 1,
        },
        isElectron: {
          ...Styles.transition('transform'),
        },
      }),
      iconBackground: Styles.platformStyles({
        common: {
          backgroundColor: Styles.globalColors.greyLight,
          borderRadius: 40,
          left: 0,
          maxHeight: 80,
          maxWidth: 80,
          minHeight: 80,
          minWidth: 80,
          position: 'absolute',
          top: 0,
        },
        isElectron: {
          ...Styles.transition('opacity'),
        },
      }),
      iconContainer: {
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 25,
        maxHeight: 80,
        maxWidth: 80,
        minHeight: 80,
        minWidth: 80,
        position: 'relative',
      },
      rowContainer: Styles.platformStyles({
        common: {
          ...Styles.globalStyles.flexBoxRow,
          alignItems: 'center',
          maxHeight: 100,
          minHeight: 100,
          padding: 20,
        },
        isElectron: {
          transition: 'background 0.1s ease-out',
        },
      }),
    } as const)
)

export default Row
