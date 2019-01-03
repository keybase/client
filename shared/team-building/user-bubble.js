// @flow
import React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import {serviceIdToIconFont, serviceIdToAccentColor} from './shared'
import type {ServiceIdWithContact} from '../constants/types/team-building'

// TODO
// * Add service icons and colors
// * style

export type Props = {
  username: string,
  prettyName: string,
  service: ServiceIdWithContact,
  onRemove: () => void,
}

const KeybaseUserBubble = (props: Props) => (
  <Kb.Box2 className="user" direction="horizontal" style={styles.bubble}>
    <Kb.Avatar size={bubbleSize} username={props.username} />
  </Kb.Box2>
)

const GeneralServiceBubble = (props: Props) => (
  <Kb.Icon
    fontSize={bubbleSize}
    type={serviceIdToIconFont(props.service)}
    colorOverride={serviceIdToAccentColor(props.service)}
  />
)

const RemoveBubble = ({onRemove, prettyName}: {onRemove: () => void, prettyName: string}) => (
  <Kb.WithTooltip text={prettyName} position={'top center'} containerStyle={styles.remove} className="remove">
    <Kb.ClickableBox onClick={() => onRemove()} style={styles.removeBubbleTextAlignCenter}>
      <Kb.Icon
        type={'iconfont-close'}
        color={Styles.globalColors.white}
        fontSize={20}
        style={Kb.iconCastPlatformStyles(styles.removeIcon)}
      />
    </Kb.ClickableBox>
  </Kb.WithTooltip>
)

const UserBubble = (props: Props) => {
  const HoverComponent = Kb.HoverHoc(
    () =>
      props.service === 'keybase' ? <KeybaseUserBubble {...props} /> : <GeneralServiceBubble {...props} />,
    () => <RemoveBubble prettyName={props.prettyName} onRemove={props.onRemove} />
  )

  return <HoverComponent containerStyle={styles.container} />
}

// TODO update mobile bubble size
const bubbleSize = 32

const styles = Styles.styleSheetCreate({
  bubble: Styles.platformStyles({
    common: {
      height: bubbleSize,
      width: bubbleSize,
    },
  }),

  container: Styles.platformStyles({
    common: {
      marginLeft: Styles.globalMargins.tiny,
    },
  }),

  generalService: {
    backgroundColor: 'grey',
    borderRadius: 100,
    height: bubbleSize,
    width: bubbleSize,
  },

  remove: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.red,
      borderRadius: 100,
      height: bubbleSize,
      width: bubbleSize,
    },
    isElectron: {
      cursor: 'pointer',
    },
  }),

  removeBubbleTextAlignCenter: {
    textAlign: 'center',
  },

  removeIcon: Styles.platformStyles({
    isElectron: {
      lineHeight: '34px',
    },
    isMobile: {
      lineHeight: 34,
    },
  }),
})

export default UserBubble
