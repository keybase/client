// @flow
import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

type Props = {|
  heading: 'To' | 'From',
  headingAlignment: 'Left' | 'Right',
  bottomDivider?: boolean,
  dividerColor?: string,
  style?: Styles.StylesCrossPlatform,
  headingStyle?: Styles.StylesCrossPlatform,
  children?: React.Node,
|}

// A row for use in Participants components; provides a blue heading to the left of the content.
const ParticipantsRow = (props: Props) => (
  <React.Fragment>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={Styles.collapseStyles([styles.row, props.style])}>
      <Kb.Text
        type="BodyTinySemibold"
        style={Styles.collapseStyles([
          styles.headingText,
          props.headingAlignment === 'Right' ? {textAlign: 'right', width: 32} : {},
          props.headingStyle,
        ])}
      >
        {props.heading}:
      </Kb.Text>
      {props.children}
    </Kb.Box2>
    {props.bottomDivider && (
      <Kb.Divider style={props.dividerColor ? {backgroundColor: props.dividerColor} : {}} />
    )}
  </React.Fragment>
)

ParticipantsRow.defaultProps = {
  bottomDivider: true,
  headingAlignment: 'Left',
}

const styles = Styles.styleSheetCreate({
  headingText: {
    color: Styles.globalColors.blue,
    marginRight: Styles.globalMargins.tiny,
  },
  row: {
    alignItems: 'center',
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
})

export default ParticipantsRow
