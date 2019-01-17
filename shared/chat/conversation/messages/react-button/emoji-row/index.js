// @flow
import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'

type Props = {
  attachTo: () => ?React.Component<any>,
  emojis: Array<string>, // e.g. :smile:, :tada:
  onHidden: () => void,
  style?: Styles.StylesCrossPlatform,
  visible: boolean,
}

const HoverBox = Styles.styled(Kb.Box2)({
  '&:hover': {
    boxShadow: 'none',
  },
  boxShadow: '0 0 15px 0 rgba(0, 0, 0, 0.2)',
})

const EmojiRow = (props: Props) => (
  <>
    {props.visible && (
      <Kb.FloatingBox
        attachTo={props.attachTo}
        onHidden={props.onHidden}
        position="bottom right"
        containerStyle={props.style}
      >
        <HoverBox direction="horizontal" style={styles.innerContainer}>
          <Kb.Box2 direction="horizontal" gap="tiny" style={styles.emojiContainer}>
            {props.emojis.map(e => (
              <Kb.EmojiIfExists size={16} lineClamp={1} emojiName={e} key={e} />
            ))}
          </Kb.Box2>
        </HoverBox>
      </Kb.FloatingBox>
    )}
  </>
)

const styles = Styles.styleSheetCreate({
  emojiContainer: {
    paddingBottom: Styles.globalMargins.xtiny,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
    paddingTop: Styles.globalMargins.xtiny,
  },
  innerContainer: Styles.platformStyles({
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_10,
      borderRadius: 4,
      borderStyle: 'solid',
      borderWidth: 1,
      overflowX: 'hidden',
      overflowY: 'auto',
      position: 'relative',
    },
  }),
})

export default EmojiRow
