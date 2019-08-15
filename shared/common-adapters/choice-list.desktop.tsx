import * as React from 'react'
import {Box, Text, Icon, IconType} from '../common-adapters'
import * as Styles from '../styles'
import {Props} from './choice-list'

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
            ])}
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
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    width: 80,
    background: Styles.globalColors.greyLight,
  },
  icon: {
    height: 48,
    width: 48,
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
