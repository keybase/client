import {Box2} from './box'
import ClickableBox from './clickable-box'
import Text from './text'
import IconAuto from './icon-auto'
import * as Styles from '@/styles'
import type {Props} from './choice-list'
import './choice-list.css'

const Kb = {
  Box2,
  ClickableBox,
  IconAuto,
  Text,
}

const ChoiceList = ({options}: Props) => {
  return (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      {options.map((op, idx) => {
        const iconType = op.icon
        return (
          <Kb.ClickableBox key={idx} onClick={() => op.onClick()}>
            <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.entry} className="cl-entry">
              <Kb.Box2
                direction="vertical"
                centerChildren={true}
                style={styles.iconContainer}
                className="cl-icon-container"
              >
                {typeof op.icon === 'string' ? (
                  <Kb.IconAuto style={styles.icon} type={iconType} className="cl-icon" />
                ) : (
                  <Kb.Box2 direction="vertical" style={styles.icon} className="cl-icon">
                    {op.icon}
                  </Kb.Box2>
                )}
              </Kb.Box2>
              <Kb.Box2 direction="vertical" alignItems="flex-start" justifyContent="center" flex={1} style={styles.infoContainer}>
                <Text type="BodyBigLink">{op.title}</Text>
                <Text type="Body">{op.description}</Text>
              </Kb.Box2>
            </Kb.Box2>
          </Kb.ClickableBox>
        )
      })}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  entry: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.clickable,
      ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
    },
  }),
  icon: {
    height: 48,
    width: 48,
  },
  iconContainer: {
    background: Styles.globalColors.greyLight,
    height: 80,
    width: 80,
  },
  infoContainer: {
    marginLeft: Styles.globalMargins.small,
    textAlign: 'left',
  },
}))

export default ChoiceList
