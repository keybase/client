import * as React from 'react'
import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import PeopleItem from '../item'

type Props = {
  badged: boolean
  confirmLabel: string | null
  iconUrl: string | null
  onConfirm: () => void
  onDismiss: (() => void) | null
  text: string
  url: string | null
}

const Announcement = (props: Props) => {
  return (
    <PeopleItem
      badged={props.badged}
      icon={
        props.iconUrl ? (
          <Kb.Image src={props.iconUrl} style={styles.icon} />
        ) : (
          <Kb.Icon type="icon-keybase-logo-80" style={styles.icon} />
        )
      }
    >
      <Kb.Text type="Body">{props.text}</Kb.Text>
      {(!!props.confirmLabel || !!props.onDismiss) && (
        <Kb.Box2 direction="horizontal" gap="tiny" centerChildren={true} style={styles.container}>
          {!!props.confirmLabel && (
            <Kb.Button small={true} label={props.confirmLabel} onClick={props.onConfirm} />
          )}
          {!!props.onDismiss && (
            <Kb.Text type="BodyPrimaryLink" onClick={props.onDismiss}>
              Later
            </Kb.Text>
          )}
        </Kb.Box2>
      )}
    </PeopleItem>
  )
}

const styles = Styles.styleSheetCreate({
  container: {alignSelf: 'flex-start'},
  icon: {flexShrink: 0, height: 32, width: 32},
})

export default Announcement
