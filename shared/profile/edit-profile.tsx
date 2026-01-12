import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useTrackerState} from '@/stores/tracker2'
import {useProfileState} from '@/stores/profile'
import {useCurrentUserState} from '@/stores/current-user'

const Container = () => {
  const username = useCurrentUserState(s => s.username)
  const d = useTrackerState(s => s.getDetails(username))
  const _bio = d.bio || ''
  const _fullname = d.fullname || ''
  const _location = d.location || ''

  const navigateUp = C.useRouterState(s => s.dispatch.navigateUp)
  const onCancel = () => {
    navigateUp()
  }

  const editProfile = useProfileState(s => s.dispatch.editProfile)
  const onSubmit = (bio: string, fullname: string, location: string) => {
    editProfile(bio, fullname, location)
    navigateUp()
  }

  const title = 'Edit Profile'

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
    <Kb.PopupWrapper onCancel={onCancel} title={title}>
      <Kb.ScrollView>
        <Kb.Box2 fullWidth={true} direction="vertical" style={styles.container}>
          {Kb.Styles.isMobile ? null : (
            <Kb.Text type="Header" style={styles.header}>
              Edit Profile
            </Kb.Text>
          )}
          <Kb.RoundedBox side="top">
            <Kb.PlainInput
              value={fullname}
              placeholder="Full name"
              autoFocus={true}
              onChangeText={setFullname}
              style={styles.widthFix}
            />
          </Kb.RoundedBox>
          <Kb.RoundedBox side="middle">
            <Kb.PlainInput
              value={bio}
              placeholder="Bio"
              multiline={true}
              rowsMin={7}
              rowsMax={7}
              onChangeText={setBio}
              style={styles.widthFix}
            />
          </Kb.RoundedBox>
          <Kb.RoundedBox side="bottom">
            <Kb.PlainInput
              value={location}
              placeholder="Location"
              onChangeText={setLocation}
              onEnterKeyDown={submit}
              style={styles.widthFix}
            />
          </Kb.RoundedBox>
          <Kb.Box2 direction="vertical" style={styles.gap} />
          <Kb.WaitingButton
            waitingKey={C.waitingKeyTracker}
            label="Save"
            disabled={disabled()}
            onClick={submit}
          />
          {bio.length > maxBio && <Kb.Text type="BodySmallError">Bio too long, sorry</Kb.Text>}
        </Kb.Box2>
      </Kb.ScrollView>
    </Kb.PopupWrapper>
  )
}

const maxBio = 255

const styles = Kb.Styles.styleSheetCreate(() => ({
  bio: {maxHeight: undefined},
  container: Kb.Styles.platformStyles({
    common: {padding: Kb.Styles.globalMargins.small},
    isElectron: {
      height: 450,
      width: 350,
    },
  }),
  gap: {flexGrow: 1, minHeight: Kb.Styles.globalMargins.small},
  header: {marginBottom: Kb.Styles.globalMargins.small},
  widthFix: Kb.Styles.platformStyles({
    isElectron: {
      width: 'auto',
    },
  }),
}))

export default Container
