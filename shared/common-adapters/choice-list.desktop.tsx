import * as React from 'react'
import {Box, Text, Icon, IconType} from '../common-adapters'
import * as Styles from '../styles'
import {Props} from './choice-list'
import { darkColors } from '../styles/colors';

const ChoiceList = ({options}: Props) => {
  return (
    <Box>
      <style>{rawCSS}</style>
      {options.map((op, idx) => {
        // TODO is this okay?
        const iconType: IconType = op.icon as IconType
        return (
          <Box style={Styles.collapseStyles([Styles.globalStyles.flexBoxRow, Styles.desktopStyles.clickable, styles.entry])} key={idx} className="cl-entry" onClick={() => op.onClick()}>
            <Box style={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, styles.iconContainer])} className="cl-icon-container">
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

const rawCSS = `
  .cl-entry {
    background-color: transparent;
  }
  .cl-entry:hover {
    background-color: ${Styles.globalColors.blueLighter2};
  }
  .darkMode .cl-entry:hover {
    background-color: ${darkColors.blueLighter2}
  }

  .cl-icon {
    transform-origin: center center;
    transition: 0.5s transform;
  }
  .cl-entry:hover .cl-icon {
    transform: translateX(25%);
  }

  .cl-icon-container {
    transition: 0.5s background;
    border-radius: 50%;
  }
  .cl-entry:hover .cl-icon-container {
    background: transparent;
  }
`

const styles = Styles.styleSheetCreate(() => ({
  entry: {
    padding: `${Styles.globalMargins.tiny}px ${Styles.globalMargins.small}px`,
    width: '100%'
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
    width: 48
  },
  infoContainer: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
    marginLeft: Styles.globalMargins.small,
    textAlign: 'left', 
  }
}))

export default ChoiceList
