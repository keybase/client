import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

const CaptionedButton = (props: {
  label: string
  caption: string
  onClick: () => void
  style?: Styles.StylesCrossPlatform
  waitOnClick?: boolean
}) => (
  <Kb.Box2
    direction="vertical"
    style={Styles.collapseStyles([Styles.globalStyles.flexBoxColumn, props.style])}
    gap="tiny"
  >
    {props.waitOnClick ? (
      <Kb.WaitingButton label={props.label} onClick={props.onClick} waitingKey={null} />
    ) : (
      <Kb.Button label={props.label} onClick={props.onClick} />
    )}
    <Kb.Text center={true} type="BodySmall">
      {props.caption}
    </Kb.Text>
  </Kb.Box2>
)

const DangerButton = (props: {label: string; onClick: () => void}) => (
  <Kb.ButtonBar small={true}>
    <Kb.Button type="Danger" small={true} label={props.label} onClick={props.onClick} />
  </Kb.ButtonBar>
)

const CaptionedDangerIcon = ({
  icon,
  caption,
  noDanger,
  onClick,
  spinner,
}: {
  icon?: Kb.IconType
  caption: string
  noDanger?: boolean
  onClick: () => void
  spinner?: boolean
}) => {
  const color = noDanger ? undefined : Styles.globalColors.redDark
  let slot: React.ReactNode = null
  if (spinner) {
    slot = <Kb.ProgressIndicator style={{marginRight: 10, width: Styles.globalMargins.medium}} />
  } else if (icon) {
    slot = <Kb.Icon type={icon} style={{marginRight: Styles.globalMargins.tiny}} color={color} />
  } else {
    // spacer so that spinner doesn't move the text
    slot = <Kb.Box style={{marginRight: 10, width: Styles.globalMargins.medium}} />
  }
  return (
    <Kb.ClickableBox
      style={{
        ...Styles.globalStyles.flexBoxRow,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: Styles.globalMargins.tiny,
        paddingTop: Styles.globalMargins.tiny,
      }}
      onClick={onClick}
    >
      {slot}
      <Kb.Text type="BodySemibold" style={{color: color}} className="hover-underline">
        {caption}
      </Kb.Text>
      <Kb.Box style={{marginRight: 10, width: Styles.globalMargins.medium}} />
    </Kb.ClickableBox>
  )
}

export {CaptionedButton, DangerButton, CaptionedDangerIcon}
