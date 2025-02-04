import * as Constants from '@/constants/tracker2'
import * as Kb from '@/common-adapters'
import * as React from 'react'

const maxBio = 255

type Props = {
  bio: string
  fullname: string
  location: string
  title: string
  onCancel: () => void
  onSubmit: (bio: string, fullname: string, location: string) => void
}

const EditProfile = (props: Props) => {
  const [bio, setBio] = React.useState(props.bio)
  const [fullname, setFullname] = React.useState(props.fullname)
  const [location, setLocation] = React.useState(props.location)

  const disabled = () => {
    return (
      (bio === props.bio && fullname === props.fullname && location === props.location) ||
      bio.length >= maxBio
    )
  }

  const submit = () => {
    props.onSubmit(bio, fullname, location)
  }

  return (
    <Kb.PopupWrapper onCancel={props.onCancel} title={props.title}>
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
            />
          </Kb.RoundedBox>
          <Kb.RoundedBox side="bottom">
            <Kb.PlainInput
              value={location}
              placeholder="Location"
              onChangeText={setLocation}
              onEnterKeyDown={submit}
            />
          </Kb.RoundedBox>
          <Kb.Box2 direction="vertical" style={styles.gap} />
          <Kb.WaitingButton
            waitingKey={Constants.waitingKey}
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  bio: {
    maxHeight: undefined,
  },
  container: Kb.Styles.platformStyles({
    common: {
      padding: Kb.Styles.globalMargins.small,
    },
    isElectron: {
      height: 450,
      width: 350,
    },
  }),
  gap: {flexGrow: 1, minHeight: Kb.Styles.globalMargins.small},
  header: {marginBottom: Kb.Styles.globalMargins.small},
}))

export default EditProfile
