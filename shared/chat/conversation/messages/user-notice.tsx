import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

export type Props = {
  children?: React.ReactNode
  noUsername?: boolean
  showAvatar?: boolean
}

const UserNotice = ({children, noUsername}: Props) => (
  <Kb.Box2
    key="content"
    direction="vertical"
    alignSelf="flex-start"
    fullWidth={true}
    style={noUsername ? styles.noUsernameShim : {}}
  >
    {children}
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate(
  () =>
    ({
      noUsernameShim: Styles.platformStyles({
        common: {
          paddingBottom: Styles.globalMargins.xtiny,
        },
        isElectron: {
          marginLeft: Styles.globalMargins.small,
        },
        isMobile: {
          // Removes extra mobile padding from containerNoUsername
          marginLeft: -(Styles.globalMargins.mediumLarge + Styles.globalMargins.tiny),
        },
      }),
    } as const)
)
export default UserNotice
