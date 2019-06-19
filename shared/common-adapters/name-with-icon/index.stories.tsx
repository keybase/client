import * as React from 'react'
import * as Sb from '../../stories/storybook'
import Text from '../text'
import NameWithIcon from '../name-with-icon'

const commonProps = {
  colorFollowing: true,
  containerStyle: {padding: 24},
}

const innerClick = evt => {
  evt.preventDefault()
  Sb.action('Inner click')(evt)
}

const provider = Sb.createPropProviderWithCommon(
  Sb.PropProviders.Avatar(['both'], ['both']),
  Sb.PropProviders.Usernames(['cecileb', 'chrisnojima'], 'akalin')
)

const load = () => {
  Sb.storiesOf('Common/NameWithIcon', module)
    .addDecorator(provider)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Vertical', () => (
      <React.Fragment>
        <NameWithIcon
          {...commonProps}
          icon="icon-computer-96"
          title="Home laptop"
          metaOne="Current device"
          metaTwo="Computer"
          size="big"
        />
        <NameWithIcon {...commonProps} icon="icon-phone-48" title="iPhone 8" metaTwo="Phone" size="small" />
        <NameWithIcon
          {...commonProps}
          teamname="keybasefriends"
          title="keybasefriends"
          metaOne="786 members"
          metaTwo="TEAM"
          size="big"
        />
        <NameWithIcon
          {...commonProps}
          teamname="keybasefriends"
          title="keybasefriends"
          metaOne="786 members"
          size="small"
        />
        <NameWithIcon
          {...commonProps}
          username="ayoubd"
          isYou={true}
          metaOne="Danny Ayoub"
          metaTwo="Admin"
          size="default"
        />
        <NameWithIcon {...commonProps} username="cecileb" metaOne="Cécile Boucheron" size="small" />
        <NameWithIcon
          {...commonProps}
          onClick={Sb.action('Clicked!')}
          username="mlsteele"
          metaOne="Miles Steele"
          size="small"
        />
        <NameWithIcon {...commonProps} username="both" metaOne="Chris Nojima" metaTwo="Admin" size="big" />
        <NameWithIcon {...commonProps} username="both" metaOne="Chris Nojima" metaTwo="Admin" size="huge" />
      </React.Fragment>
    ))
    .add('Horizontal', () => (
      <React.Fragment>
        <NameWithIcon
          {...commonProps}
          horizontal={true}
          username="cecileb"
          metaOne="Cécile Boucheron"
          containerStyle={{padding: 4}}
        />
        <NameWithIcon
          {...commonProps}
          horizontal={true}
          teamname="keybase"
          title="keybase"
          metaOne="19 members"
          metaTwo="the best team"
          containerStyle={{padding: 4}}
        />
      </React.Fragment>
    ))
    .add('Subcomponents', () => (
      <React.Fragment>
        <NameWithIcon
          {...commonProps}
          teamname="keybasefriends"
          title="keybasefriends"
          onClick={Sb.action('Outer click')}
          metaOne={
            <Text type="BodySmallPrimaryLink" onClick={innerClick}>
              Manage members
            </Text>
          }
        />
      </React.Fragment>
    ))
}

export default load
