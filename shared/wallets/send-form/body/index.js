// @flow
import * as React from 'react'
import {Divider, Box2, Text} from '../../../common-adapters'
import {styleSheetCreate} from '../../../styles'
import AssetInput from '../asset-input'
import Banner from '../banner'
import Memo from '../memo'
import Note from '../note'
import Participants from '../participants'

type Props = {
  skeleton: null,
  bannerInfo: ?string,
}

const Body = ({skeleton, bannerInfo}: Props) => (
  <Box2 direction="vertical">
    (bannerInfo ?
    <Banner skeleton={skeleton} />
    : null)
    <Participants skeleton={skeleton} />
    <Divider />
    <AssetInput skeleton={skeleton} />
    <Memo skeleton={skeleton} />
    <Note skeleton={skeleton} />
    <Text type="Body" style={styles.text}>
      Body {skeleton}
    </Text>
  </Box2>
)

const styles = styleSheetCreate({
  text: {
    textAlign: 'center',
  },
})

export default Body
