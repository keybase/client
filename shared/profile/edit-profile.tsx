import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useTrackerState} from '@/stores/tracker'
import {useCurrentUserState} from '@/stores/current-user'
import {generateGUIID} from '@/constants/utils'
import * as T from '@/constants/types'

const Container = () => {
  const username = useCurrentUserState(s => s.username)
  const d = useTrackerState(s => s.getDetails(username))
  const loadProfile = useTrackerState(s => s.dispatch.load)
  const _bio = d.bio || ''
  const _fullname = d.fullname || ''
  const _location = d.location || ''

  const navigateUp = C.Router2.navigateUp
  const editProfile = C.useRPC(T.RPCGen.userProfileEditRpcPromise)
  const onSubmit = (bio: string, fullname: string, location: string) => {
    editProfile(
      [{bio, fullName: fullname, location}, C.waitingKeyTracker],
      () => {
        loadProfile({assertion: username, guiID: generateGUIID(), inTracker: false, reason: ''})
        navigateUp()
      },
      () => {}
    )
  }

  const [bio, setBio] = React.useState(_bio)
  const [fullname, setFullname] = React.useState(_fullname)
  const [location, setLocation] = React.useState(_location)

  const disabled = () => {
    return (_bio === bio && _fullname === fullname && _location === location) || bio.length >= maxBio
  }

  const submit = () => {
    onSubmit(bio, fullname, location)
  }

  return (
    <>
      <Kb.ScrollView>
        <Kb.Box2 fullWidth={true} direction="vertical" style={styles.container}>
          <Kb.RoundedBox side="top">
            <Kb.Input3
              value={fullname}
              placeholder="Full name"
              autoFocus={true}
              onChangeText={setFullname}
              hideBorder={true}
            />
          </Kb.RoundedBox>
          <Kb.RoundedBox side="middle">
            <Kb.Input3
              value={bio}
              placeholder="Bio"
              multiline={true}
              rowsMin={7}
              rowsMax={7}
              onChangeText={setBio}
              hideBorder={true}
            />
          </Kb.RoundedBox>
          <Kb.RoundedBox side="bottom">
            <Kb.Input3
              value={location}
              placeholder="Location"
              onChangeText={setLocation}
              onEnterKeyDown={submit}
              hideBorder={true}
            />
          </Kb.RoundedBox>
          <Kb.Box2 direction="vertical" flex={1} style={styles.gap} />
          <Kb.WaitingButton
            waitingKey={C.waitingKeyTracker}
            label="Save"
            disabled={disabled()}
            onClick={submit}
          />
          {bio.length > maxBio && <Kb.Text type="BodySmallError">Bio too long, sorry</Kb.Text>}
        </Kb.Box2>
      </Kb.ScrollView>
    </>
  )
}

const maxBio = 255

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: Kb.Styles.platformStyles({
    common: {padding: Kb.Styles.globalMargins.small},
    isElectron: {
      width: 350,
    },
  }),
  gap: {minHeight: Kb.Styles.globalMargins.small},
}))

export default Container
