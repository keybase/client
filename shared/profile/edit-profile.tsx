import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {useCurrentUserState} from '@/stores/current-user'
import * as T from '@/constants/types'
import {useTrackerProfile} from '@/tracker/use-profile'

const Container = () => {
  const username = useCurrentUserState(s => s.username)
  const {details: d, loadProfile} = useTrackerProfile(username)
  const _bio = d.bio || ''
  const _fullname = d.fullname || ''
  const _location = d.location || ''

  const navigateUp = C.Router2.navigateUp
  const editProfile = C.useRPC(T.RPCGen.userProfileEditRpcPromise)
  const onSubmit = (bio: string, fullname: string, location: string) => {
    editProfile(
      [{bio, fullName: fullname, location}, C.waitingKeyTracker],
      () => {
        loadProfile(false)
        navigateUp()
      },
      () => {}
    )
  }

  const [bio, setBio] = React.useState(_bio)
  const [fullname, setFullname] = React.useState(_fullname)
  const [location, setLocation] = React.useState(_location)
  const loadedValuesRef = React.useRef({
    bio: _bio,
    fullname: _fullname,
    location: _location,
  })

  React.useEffect(() => {
    const previousLoadedValues = loadedValuesRef.current
    if (bio === previousLoadedValues.bio) {
      setBio(_bio)
    }
    if (fullname === previousLoadedValues.fullname) {
      setFullname(_fullname)
    }
    if (location === previousLoadedValues.location) {
      setLocation(_location)
    }
    loadedValuesRef.current = {
      bio: _bio,
      fullname: _fullname,
      location: _location,
    }
  }, [_bio, _fullname, _location, bio, fullname, location])

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
