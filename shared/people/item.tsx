import * as React from 'react'
import * as Kb from '@/common-adapters'
import {formatTimeForPeopleItem} from '@/util/timestamp'
import type {Props as ButtonProps} from '@/common-adapters/button'

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
  contentStyle?: Kb.Styles.StylesCrossPlatform
  format?: 'single' | 'multi'
  iconContainerStyle?: Kb.Styles.StylesCrossPlatform
  buttons?: Array<TaskButton>
}

const PeopleItem = (props: Props) => (
  <Kb.Box style={Kb.Styles.collapseStyles([styles.container, props.badged && styles.containerBadged])}>
    {!!props.icon && (
      <Kb.Box key="icon" style={Kb.Styles.collapseStyles([styles.iconContainer, props.iconContainerStyle])}>
        {props.icon}
      </Kb.Box>
    )}

    <Kb.Box2
      direction="vertical"
      gap="xtiny"
      style={Kb.Styles.collapseStyles([styles.childrenContainer, props.contentStyle])}
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
      style={Kb.Styles.collapseStyles([
        styles.timestampContainer,
        props.format === 'multi' && styles.timestampContainerMulti,
      ])}
    >
      {!!props.when && <Kb.Text type="BodyTiny">{formatTimeForPeopleItem(props.when.getTime())}</Kb.Text>}
      {props.badged && (
        <Kb.Badge badgeStyle={styles.badge} height={Kb.Styles.globalMargins.tiny} leftRightPadding={0} />
      )}
    </Kb.Box>
  </Kb.Box>
)
export default PeopleItem

const styles = Kb.Styles.styleSheetCreate(() => ({
  actionContainer: {
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  badge: {
    marginLeft: Kb.Styles.globalMargins.xtiny,
  },
  button: {marginBottom: Kb.Styles.globalMargins.xtiny, marginRight: Kb.Styles.globalMargins.tiny},
  childrenContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    width: 'auto',
  },
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      backgroundColor: Kb.Styles.globalColors.white,
      borderBottomColor: Kb.Styles.globalColors.black_10,
      borderBottomWidth: 1,
      paddingBottom: Kb.Styles.globalMargins.xsmall,
      paddingTop: Kb.Styles.globalMargins.xsmall,
      position: 'relative',
    },
    isElectron: {borderStyle: 'solid'},
  }),
  containerBadged: {
    backgroundColor: Kb.Styles.globalColors.blueLighter2,
    borderBottomColor: Kb.Styles.globalColors.white,
  },
  iconContainer: {
    marginLeft: Kb.Styles.globalMargins.small,
    marginRight: Kb.Styles.globalMargins.xsmall,
    width: 48,
  },
  timestampContainer: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      alignSelf: 'center',
      marginLeft: 'auto',
      marginRight: Kb.Styles.globalMargins.small,
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
