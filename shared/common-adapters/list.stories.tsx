import * as React from 'react'
import Button from './button'
import Box, {Box2} from './box'
import Text from './text'
import List2 from './list2'
import * as Sb from '../stories/storybook'
import * as Styles from '../styles'

const load = () =>
  Sb.storiesOf('Common/List2', module)
    .add('fixed - small', () => (
      <Box style={styles.listContainer}>
        <List2
          items={['a', 'b', 'c', 'd', 'e']}
          bounces={true}
          indexAsKey={true}
          itemHeight={{height: 32, type: 'fixed'}}
          renderItem={(_, item) => (
            <Box2 direction="horizontal" style={styles.listItem} centerChildren={true} fullWidth={true}>
              <Text type="Body">{item}</Text>
            </Box2>
          )}
        />
      </Box>
    ))
    .add('fixed - full', () => (
      <Box style={styles.listContainer}>
        <List2
          items={['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']}
          bounces={true}
          indexAsKey={true}
          itemHeight={{height: 32, type: 'fixed'}}
          renderItem={(_, item) => (
            <Box2 direction="horizontal" style={styles.listItem} centerChildren={true} fullWidth={true}>
              <Text type="Body">{item}</Text>
            </Box2>
          )}
        />
      </Box>
    ))
    .add('variable - full', () => (
      <Box style={styles.listContainer}>
        <List2
          items={['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']}
          bounces={true}
          indexAsKey={true}
          itemHeight={{
            getItemLayout: index => ({
              index,
              length: index % 2 === 0 ? 32 : 64,
              offset: Math.floor(index / 2) * (32 + 64) + (index % 2) * 32,
            }),
            type: 'variable',
          }}
          renderItem={(index, item) => (
            <Box2
              direction="horizontal"
              style={index % 2 === 0 ? styles.listItem : styles.listItemAlternate}
              centerChildren={true}
              fullWidth={true}
            >
              <Text type="Body">{item}</Text>
            </Box2>
          )}
        />
      </Box>
    ))
    .add('fixed - props change ', () => <PropsChangeTester />)

class PropsChangeTester extends React.PureComponent<
  {},
  {
    counter: number
  }
> {
  state = {
    counter: 0,
  }
  render() {
    return (
      <>
        <Button
          label="increase"
          onClick={() =>
            this.setState(prevState => ({
              counter: prevState.counter + 1,
            }))
          }
        />
        <Box style={styles.listContainer}>
          <List2
            items={[{val: this.state.counter}]}
            bounces={true}
            indexAsKey={true}
            itemHeight={{height: 32, type: 'fixed'}}
            renderItem={(_, item) => (
              <Box2 direction="horizontal" style={styles.listItem} centerChildren={true} fullWidth={true}>
                <Text type="Body">{item.val.toString()}</Text>
              </Box2>
            )}
          />
        </Box>
      </>
    )
  }
}
const styles = Styles.styleSheetCreate({
  listContainer: {
    backgroundColor: Styles.globalColors.red,
    height: 300,
    width: 200,
  },
  listItem: {
    backgroundColor: Styles.globalColors.white,
    height: 32,
  },
  listItemAlternate: {
    backgroundColor: Styles.globalColors.greyDark,
    height: 64,
  },
})

export default load
