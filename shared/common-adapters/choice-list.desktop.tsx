import {Box, Text, Icon, type IconType} from '.'
import * as Styles from '../styles'
import type {Props} from './choice-list'
import './choice-list.css'

const ChoiceList = ({options}: Props) => {
  return (
    <Box>
      {options.map((op, idx) => {
        // TODO is this okay?
        const iconType: IconType = op.icon as IconType
        return (
          <Box
            style={Styles.collapseStyles([
              Styles.globalStyles.flexBoxRow,
              Styles.desktopStyles.clickable,
              styles.entry,
            ] as any)}
            key={idx}
            className="cl-entry"
            onClick={() => op.onClick()}
          >
            <Box
              style={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, styles.iconContainer])}
              className="cl-icon-container"
            >
              {typeof op.icon === 'string' ? (
                <Icon style={styles.icon} type={iconType} className="cl-icon" />
              ) : (
                <Box style={styles.icon} className="cl-icon">
                  {op.icon}
                </Box>
              )}
            </Box>
            <Box style={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, styles.infoContainer])}>
              <Text type="BodyBigLink">{op.title}</Text>
              <Text type="Body">{op.description}</Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  entry: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
    width: '100%',
  },
  icon: {
    height: 48,
    width: 48,
  },
  iconContainer: {
    alignItems: 'center',
    background: Styles.globalColors.greyLight,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  infoContainer: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
    marginLeft: Styles.globalMargins.small,
    textAlign: 'left',
  },
}))

export default ChoiceList
