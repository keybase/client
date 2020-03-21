import * as React from 'react'
import * as Kb from '../../../../../common-adapters'
import * as Styles from '../../../../../styles'
import * as Types from '../../../../../constants/types/chat2'
import * as Container from '../../../../../util/container'
import * as Chat2Gen from '../../../../../actions/chat2-gen'

const skinTones: Array<Types.EmojiSkinTone> = ['default', '1F3FB', '1F3FC', '1F3FD', '1F3FE', '1F3FF']
const skinToneToDotColor = (skinTone: Types.EmojiSkinTone): string => {
  switch (skinTone) {
    case 'default':
      return '#ffc93a'
    case '1F3FB':
      return '#fadcbc'
    case '1F3FC':
      return '#e1bb95'
    case '1F3FD':
      return '#bf9068'
    case '1F3FE':
      return '#9b643d'
    case '1F3FF':
      return '#5a4539'
  }
}

const circle = (skinTone: Types.EmojiSkinTone) => (
  <Kb.Box style={Styles.collapseStyles([styles.inner, {backgroundColor: skinToneToDotColor(skinTone)}])} />
)

const SkinTonePicker = () => {
  const emojiSkinTone = Container.useSelector(state => state.chat2.emojiSkinTone)
  const dispatch = Container.useDispatch()
  const setSkinTone = (skinTone: Types.EmojiSkinTone) => dispatch(Chat2Gen.createSetEmojiSkinTone({skinTone}))
  const [expanded, setExpanded] = React.useState(false)
  return (
    <Kb.Box style={styles.relative}>
      {expanded ? (
        <Kb.Box style={styles.popupContainer}>
          {skinTones.map(skinTone => (
            <Kb.ClickableBox
              key={skinTone}
              style={styles.popupDotContainer}
              onClick={() => {
                setSkinTone(skinTone)
                setExpanded(false)
              }}
            >
              {circle(skinTone)}
            </Kb.ClickableBox>
          ))}
        </Kb.Box>
      ) : (
        <Kb.WithTooltip tooltip="Skin tone" containerStyle={styles.absolute}>
          <Kb.ClickableBox style={styles.dotContainer} onClick={() => setExpanded(true)}>
            {circle(emojiSkinTone)}
          </Kb.ClickableBox>
        </Kb.WithTooltip>
      )}
      <Kb.Box style={styles.dotPlaceholder} />
    </Kb.Box>
  )
}

export default SkinTonePicker

const styles = Styles.styleSheetCreate(() => ({
  absolute: {position: 'absolute'},
  dotContainer: {
    flexShrink: 0,
    padding: Styles.globalMargins.tiny,
  },
  dotPlaceholder: {
    height: Styles.globalMargins.small * 2,
    width: Styles.globalMargins.small * 2,
  },
  inner: {
    borderRadius: Styles.globalMargins.small / 2,
    height: Styles.globalMargins.small,
    width: Styles.globalMargins.small,
  },
  popupContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_10,
    borderRadius: Styles.globalMargins.small,
    borderStyle: 'solid',
    borderWidth: 1,
    marginLeft: Styles.globalMargins.xtiny,
    marginTop: Styles.globalMargins.xtiny,
    padding: Styles.globalMargins.xxtiny,
    position: 'absolute',
    zIndex: 1,
  },
  popupDotContainer: {
    padding: Styles.globalMargins.xxtiny,
  },
  relative: {position: 'relative'},
}))
