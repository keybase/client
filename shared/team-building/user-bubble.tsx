import * as React from 'react'
import * as Kb from '../common-adapters/index'
import * as Styles from '../styles'
import DesktopStyle from '../common-adapters/desktop-style'
import {serviceIdToIconFont, serviceIdToAccentColor} from './shared'
import {ServiceIdWithContact} from '../constants/types/team-building'

export type Props = {
  username: string
  prettyName: string
  service: ServiceIdWithContact
  onRemove: () => void
}

const bubbleSize = 32
const removeSize = 16

const KeybaseUserBubbleMobile = (props: Props) => <Kb.Avatar size={bubbleSize} username={props.username} />

const GeneralServiceBubble = (props: Props) => (
  <Kb.Icon
    style={styles.generalService}
    fontSize={bubbleSize}
    type={serviceIdToIconFont(props.service)}
    colorOverride={serviceIdToAccentColor(props.service)}
  />
)

const DesktopBubble = (props: Props) => {
  const realCSS = `
    .hoverContainer { position: relative; }
    .hoverContainer .hoverComponent { visibility: hidden; position: absolute; top: 0; right: 0; }
    .hoverContainer:hover .hoverComponent { visibility: visible; }
    `
  return (
    <Kb.Box2 direction="vertical" className="hoverContainer">
      <DesktopStyle style={realCSS} />
      <Kb.Box2 className="user" direction="horizontal" style={styles.bubble}>
        <Kb.ConnectedNameWithIcon
          colorFollowing={true}
          hideFollowingOverlay={true}
          horizontal={false}
          icon={props.service !== 'keybase' ? serviceIdToIconFont(props.service) : undefined}
          iconBoxStyle={props.service !== 'keybase' ? styles.iconBox : undefined}
          size="smaller"
          username={props.username}
        />
      </Kb.Box2>
      <Kb.Box2 direction="horizontal" className="hoverComponent">
        <RemoveBubble prettyName={props.prettyName} onRemove={props.onRemove} />
      </Kb.Box2>
    </Kb.Box2>
  )
}

const RemoveBubble = ({onRemove, prettyName}: {onRemove: () => void; prettyName: string}) => (
  <Kb.WithTooltip text={prettyName} position={'top center'} containerStyle={styles.remove} className="remove">
    <Kb.ClickableBox onClick={() => onRemove()} style={styles.removeBubbleTextAlignCenter}>
      <Kb.Icon
        type={'iconfont-close'}
        color={Styles.isMobile ? Styles.globalColors.white : Styles.globalColors.black_50_on_white}
        fontSize={12}
        style={Kb.iconCastPlatformStyles(styles.removeIcon)}
      />
    </Kb.ClickableBox>
  </Kb.WithTooltip>
)

type SwapOnClickProps = Kb.PropsWithTimer<
  React.PropsWithChildren<{
    clickedLayerComponent: React.ComponentType<{}>
    clickedLayerTimeout: number
    containerStyle?: Styles.StylesCrossPlatform
  }>
>

class _SwapOnClick extends React.PureComponent<
  SwapOnClickProps,
  {
    showClickedLayer: boolean
  }
> {
  state = {showClickedLayer: false}
  _onClick = () => {
    if (!this.state.showClickedLayer) {
      this.setState({showClickedLayer: true})
      if (this.props.clickedLayerTimeout) {
        this.props.setTimeout(() => this.setState({showClickedLayer: false}), this.props.clickedLayerTimeout)
      }
    }
  }

  render() {
    const ClickedLayerComponent = this.props.clickedLayerComponent
    return (
      <Kb.ClickableBox onClick={this._onClick} style={this.props.containerStyle}>
        {this.state.showClickedLayer ? <ClickedLayerComponent /> : this.props.children}
      </Kb.ClickableBox>
    )
  }
}
const SwapOnClick = Kb.HOCTimers(_SwapOnClick)

function SwapOnClickHoc(
  Component: React.ComponentType<{}>,
  OtherComponent: React.ComponentType<{}>
): React.ComponentType<{
  containerStyle?: Styles.StylesCrossPlatform
}> {
  return ({containerStyle}) => (
    <SwapOnClick
      containerStyle={containerStyle}
      clickedLayerTimeout={5e3}
      clickedLayerComponent={OtherComponent}
    >
      <Component />
    </SwapOnClick>
  )
}

const UserBubble = (props: Props) => {
  const NormalComponent = () =>
    props.service === 'keybase' ? <KeybaseUserBubbleMobile {...props} /> : <GeneralServiceBubble {...props} />
  const AlternateComponent = () => <RemoveBubble prettyName={props.prettyName} onRemove={props.onRemove} />
  const Component = SwapOnClickHoc(NormalComponent, AlternateComponent)

  return Styles.isMobile ? <Component containerStyle={styles.container} /> : <DesktopBubble {...props} />
}

const styles = Styles.styleSheetCreate({
  bubble: Styles.platformStyles({
    common: {},
    isElectron: {
      flexShrink: 1,
      marginLeft: Styles.globalMargins.tiny,
      marginRight: Styles.globalMargins.tiny,
    },
    isMobile: {
      height: bubbleSize,
      width: bubbleSize,
    },
  }),
  container: Styles.platformStyles({
    common: {
      marginBottom: Styles.globalMargins.xtiny,
      marginLeft: Styles.globalMargins.tiny,
      marginTop: Styles.globalMargins.xtiny,
    },
  }),
  generalService: Styles.platformStyles({
    isElectron: {
      lineHeight: '35px',
    },
  }),
  // TODO: the service icons are too high without this - are they right?
  iconBox: Styles.platformStyles({
    isElectron: {
      marginBottom: -3,
      marginTop: 3,
    },
  }),
  remove: Styles.platformStyles({
    common: {
      borderRadius: 100,
      height: removeSize,
      width: removeSize,
    },
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      cursor: 'pointer',
      marginRight: Styles.globalMargins.tiny,
    },
    isMobile: {
      backgroundColor: Styles.globalColors.red,
      height: bubbleSize,
      width: bubbleSize,
    },
  }),

  removeBubbleTextAlignCenter: Styles.platformStyles({
    isElectron: {
      margin: 'auto',
      textAlign: 'center',
    },
    isMobile: {
      alignItems: 'center',
      flex: 1,
    },
  }),

  removeIcon: Styles.platformStyles({
    isElectron: {
      lineHeight: '16px',
    },
    isMobile: {
      lineHeight: 34,
    },
  }),
})

export default UserBubble
