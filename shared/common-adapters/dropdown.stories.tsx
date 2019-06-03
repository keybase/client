import React from 'react'
import Box from './box'
import Text from './text'
import * as Styles from '../styles'
import * as Sb from '../stories/storybook'
import Dropdown, {InlineDropdown} from './dropdown'

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Dropdown', () => (
      <Box style={styles.container}>
        <Box style={styles.space} />
        <Dropdown
          items={[
            <Text type="BodyBig" key="pick">
              Pick a value
            </Text>,
            <Text type="BodyBig" key="one">
              One
            </Text>,
            <Text type="BodyBig" key="two">
              Two
            </Text>,
            <Text type="BodyBig" key="three">
              Three
            </Text>,
          ]}
          onChanged={Sb.action('onChanged')}
        />
        <Dropdown
          items={[
            <Text type="BodyBig" key="pick">
              Pick a value
            </Text>,
            <Text type="BodyBig" key="one">
              One
            </Text>,
            <Text type="BodyBig" key="two">
              Two
            </Text>,
            <Text type="BodyBig" key="trhee">
              Three
            </Text>,
          ]}
          onChanged={Sb.action('onChanged')}
          selected={<Text type="BodyBig">Pick a value</Text>}
          style={styles.dropdown}
        />
        <Dropdown
          items={[
            <Text type="BodyBig" key="pick">
              Pick a value
            </Text>,
            <Text type="BodyBig" key="one">
              One
            </Text>,
            <Text type="BodyBig" key="two">
              Two
            </Text>,
            <Text type="BodyBig" key="trhee">
              Three
            </Text>,
          ]}
          onChanged={Sb.action('onChanged')}
          selected={<Text type="BodyBig">Pick a value</Text>}
          style={styles.dropdown}
          disabled={true}
        />
        {([
          'top left',
          'top right',
          'bottom right',
          'bottom left',
          'right center',
          'left center',
          'top center',
          'bottom center',
          'center center',
        ] as const).map(pos => (
          <Dropdown
            key={pos}
            items={[
              <Text type="BodyBig" key="pick">
                {pos}
              </Text>,
              <Text type="BodyBig" key="one">
                One
              </Text>,
              <Text type="BodyBig" key="two">
                Two
              </Text>,
              <Text type="BodyBig" key="three">
                Three
              </Text>,
            ]}
            onChanged={Sb.action('onChanged')}
            position={pos}
            selected={<Text type="BodyBig">{pos}</Text>}
            style={styles.dropdownPositions}
          />
        ))}
        <Box style={styles.space} />
      </Box>
    ))
    .add('InlineDropdown', () => (
      <Box style={styles.container}>
        <Box style={styles.space} />
        <InlineDropdown label="Pick" type="Body" onPress={Sb.action('onPress')} />
        <InlineDropdown label="Pick" type="BodySmall" onPress={Sb.action('onPress')} />
        <Box style={styles.space} />
      </Box>
    ))
}

const styles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxCenter,
    ...Styles.globalStyles.flexBoxColumn,
    borderColor: Styles.globalColors.black_10,
    borderStyle: 'solid',
    borderWidth: 1,
    height: '100%',
    width: '100%',
  },
  dropdown: {
    marginTop: Styles.globalMargins.small,
  },
  dropdownPositions: {
    marginTop: Styles.globalMargins.small,
    width: 200,
  },
  space: {
    height: 200,
  },
})

export default load
