import * as Kb from '@/common-adapters'
import type * as React from 'react'

// the explanatory blueGrey footer row at the bottom of the channels/subteams tabs
export const InfoNoteRow = (props: {children: React.ReactNode}) => (
  <Kb.Box2 direction="vertical" alignItems="center" fullWidth={true} style={infoNoteStyles.container}>
    <Kb.InfoNote>{props.children}</Kb.InfoNote>
  </Kb.Box2>
)

export const infoNoteStyles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.large, Kb.Styles.globalMargins.medium),
    backgroundColor: Kb.Styles.globalColors.blueGrey,
  },
  text: {
    maxWidth: 326,
  },
}))

// styles shared by the selectable member/channel rows
export const selectionStyles = Kb.Styles.styleSheetCreate(() => ({
  checkCircle: {
    ...Kb.Styles.padding(Kb.Styles.globalMargins.tiny, Kb.Styles.globalMargins.small),
    alignSelf: 'center',
  },
  mobileMarginsHack: Kb.Styles.platformStyles({isMobile: {marginRight: 48}}), // ListItem is malfunctioning because the checkbox width is unusual
  widenClickableArea: {margin: -5, padding: 5},
}))
