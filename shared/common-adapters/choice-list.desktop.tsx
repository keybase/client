import {Box} from './box'
import Text from './text'
import Icon from './icon'
import * as Styles from '@/styles'
import type {Props} from './choice-list'
import './choice-list.css'

const Kb = {
  Box,
  Icon,
  Text,
}

const ChoiceList = ({options}: Props) => {
  return (
    <Kb.Box>
      {options.map((op, idx) => {
        const iconType = op.icon
        return (
          <Kb.Box style={styles.entry} key={idx} className="cl-entry" onClick={() => op.onClick()}>
            <Kb.Box
              style={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, styles.iconContainer])}
              className="cl-icon-container"
            >
              {typeof op.icon === 'string' ? (
                <Kb.Icon style={styles.icon} type={iconType} className="cl-icon" />
              ) : (
                <Kb.Box style={styles.icon} className="cl-icon">
                  {op.icon}
                </Kb.Box>
              )}
            </Kb.Box>
            <Kb.Box style={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, styles.infoContainer])}>
              <Text type="BodyBigLink">{op.title}</Text>
              <Text type="Body">{op.description}</Text>
            </Kb.Box>
          </Kb.Box>
        )
      })}
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  entry: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.desktopStyles.clickable,
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
      width: '100%',
    },
  }),
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
