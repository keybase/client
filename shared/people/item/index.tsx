import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import {formatTimeForPeopleItem} from '../../util/timestamp'
import type {Props as ButtonProps} from '../../common-adapters/button'

type NonReactTaskButton = {
  label: string
  onClick: () => void
  type?: ButtonProps['type']
  mode?: ButtonProps['mode']
  waiting?: ButtonProps['waiting']
}

export type TaskButton = NonReactTaskButton | React.ReactElement

export type Props = {
  badged: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  when?: Date
  contentStyle?: any
  format?: 'single' | 'multi'
  iconContainerStyle?: Styles.StylesCrossPlatform
  buttons?: Array<TaskButton>
}

const PeopleItem = (props: Props) => (
  <Kb.Box style={Styles.collapseStyles([styles.container, props.badged && styles.containerBadged])}>
    {!!props.icon && (
      <Kb.Box key="icon" style={Styles.collapseStyles([styles.iconContainer, props.iconContainerStyle])}>
        {props.icon}
      </Kb.Box>
    )}

    <Kb.Box2
      direction="vertical"
      gap="xtiny"
      style={Styles.collapseStyles([styles.childrenContainer, props.contentStyle])}
    >
      {props.children}
      <Kb.Box2 direction="horizontal" style={styles.actionContainer} alignItems="center" fullWidth={true}>
        {props.buttons &&
          props.buttons.length > 0 &&
          props.buttons.map((b, idx) =>
            React.isValidElement(b) ? (
              <Kb.Box key={idx} style={styles.button}>
                {b}
              </Kb.Box>
            ) : (
              <Kb.Button
                key={(b as NonReactTaskButton).label}
                small={true}
                style={styles.button}
                {...(b as NonReactTaskButton)}
              />
            )
          )}
      </Kb.Box2>
    </Kb.Box2>
    <Kb.Box
      style={Styles.collapseStyles([
        styles.timestampContainer,
        props.format === 'multi' && styles.timestampContainerMulti,
      ])}
    >
      {!!props.when && <Kb.Text type="BodyTiny">{formatTimeForPeopleItem(props.when.getTime())}</Kb.Text>}
      {props.badged && (
        <Kb.Badge badgeStyle={styles.badge} height={Styles.globalMargins.tiny} leftRightPadding={0} />
      )}
    </Kb.Box>
  </Kb.Box>
)
export default PeopleItem

const styles = Styles.styleSheetCreate(() => ({
  actionContainer: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  badge: {
    marginLeft: Styles.globalMargins.xtiny,
  },
  button: {marginBottom: Styles.globalMargins.xtiny, marginRight: Styles.globalMargins.tiny},
  childrenContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    width: 'auto',
  },
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      backgroundColor: Styles.globalColors.white,
      borderBottomColor: Styles.globalColors.black_10,
      borderBottomWidth: 1,
      paddingBottom: Styles.globalMargins.xsmall,
      paddingTop: Styles.globalMargins.xsmall,
      position: 'relative',
    },
    isElectron: {borderStyle: 'solid'},
  }),
  containerBadged: {
    backgroundColor: Styles.globalColors.blueLighter2,
    borderBottomColor: Styles.globalColors.white,
  },
  iconContainer: {
    marginLeft: Styles.globalMargins.small,
    marginRight: Styles.globalMargins.xsmall,
    width: 48,
  },
  timestampContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      alignSelf: 'center',
      marginLeft: 'auto',
      marginRight: Styles.globalMargins.small,
      marginTop: 6,
    },
    isElectron: {alignSelf: 'baseline'},
    isMobile: {
      position: 'relative',
      top: -5,
    },
  }),
  timestampContainerMulti: {
    alignSelf: 'flex-start',
    position: 'relative',
    top: -2,
  },
}))
