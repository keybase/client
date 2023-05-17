import * as React from 'react'
import * as Styles from '../../styles'
import type * as ImagePicker from 'expo-image-picker'
import type * as Types from '../../constants/types/teams'

export const options = {}

const getOptions = () => ({
  modal2: true,
  modal2ClearCover: false,
  modal2Style: styles.modal2,
  modal2Type: 'DefaultFullHeight',
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      modal2: {width: Styles.isMobile ? undefined : 500},
    } as const)
)

const EditAvatar = React.lazy(async () => import('./container'))

type OwnProps = {
  route: {
    params: {
      // Mobile-only
      image?: ImagePicker.ImageInfo
      // Team-only
      sendChatNotification?: boolean
      showBack?: boolean
      teamID?: Types.TeamID
      createdTeam?: boolean
      wizard?: boolean
    }
  }
}

const Screen = (p: OwnProps) => (
  <React.Suspense>
    <EditAvatar {...p.route.params} />
  </React.Suspense>
)
const getScreen = () => Screen

export default {profileEditAvatar: {getOptions, getScreen}}
export type RouteProps = {profileEditAvatar: OwnProps['route']['params']}
