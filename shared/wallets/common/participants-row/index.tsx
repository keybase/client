import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {
  heading: 'To' | 'From'
  headingAlignment: 'Left' | 'Right'
  bottomDivider?: boolean
  dividerColor?: string
  style?: Styles.StylesCrossPlatform
  headingStyle?: Styles.StylesCrossPlatform
  children?: React.ReactNode
}

// A row for use in Participants components; provides a blue heading to the left of the content.
class ParticipantsRow extends React.PureComponent<Props> {
  static defaultProps = {
    bottomDivider: true,
    headingAlignment: 'Left',
  }

  render() {
    const props = this.props
    return (
      <>
        <Kb.Box2
          direction="horizontal"
          fullWidth={true}
          style={Styles.collapseStyles([styles.row, props.style])}
        >
          <Kb.Text
            type="BodyTinySemibold"
            style={Styles.collapseStyles([
              styles.headingText,
              props.headingAlignment === 'Right' && {textAlign: 'right', width: 40},
              props.headingStyle,
            ])}
          >
            {props.heading}:
          </Kb.Text>
          <Kb.Box style={styles.childContainer}>
            <Kb.Box style={styles.childFillContainer}>{props.children}</Kb.Box>
          </Kb.Box>
        </Kb.Box2>
        {props.bottomDivider && (
          <Kb.Divider style={props.dividerColor ? {backgroundColor: props.dividerColor} : {}} />
        )}
      </>
    )
  }
}

const styles = Styles.styleSheetCreate({
  childContainer: Styles.platformStyles({
    isElectron: {
      width: '100%',
    },
    isMobile: {
      flex: 1,
      height: '100%',
      position: 'relative',
    },
  }),
  childFillContainer: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
    },
    isElectron: {
      alignItems: 'center',
      display: 'flex',
    },
    isMobile: {
      flex: 1,
    },
  }),
  headingText: {
    color: Styles.globalColors.blueDark,
    marginRight: Styles.globalMargins.tiny,
  },
  row: {
    alignItems: 'center',
    maxWidth: '100%',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.tiny,
    paddingTop: Styles.globalMargins.tiny,
  },
})

export default ParticipantsRow
