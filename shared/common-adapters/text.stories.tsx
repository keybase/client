import * as React from 'react'
import * as Sb from '../stories/storybook'
import Box from './box'
import Icon from './icon'
import Text, {allTextTypes, TextType} from './text'
import {globalColors, globalMargins, globalStyles, isMobile, platformStyles} from '../styles'

const SmallGap = () => <Box style={{minHeight: 24}} />
const LargeGap = () => <Box style={{minHeight: 36}} />

const displayBlock = {
  style: platformStyles({
    isElectron: {
      display: 'block',
    },
  }),
}
const hidden = {
  style: {opacity: 0},
}
const SecondaryColorBox = () => (
  <Box
    style={{
      ...globalStyles.flexBoxRow,
      ...globalStyles.fillAbsolute,
      bottom: undefined,
      flex: 1,
      height: 30,
    }}
  >
    <Box style={{backgroundColor: globalColors.blueDarker2, flex: 1}} />
    <Box style={{backgroundColor: globalColors.blue, flex: 1}} />
    <Box style={{backgroundColor: globalColors.red, flex: 1}} />
    <Box style={{backgroundColor: globalColors.green, flex: 1}} />
    <Box style={{backgroundColor: globalColors.blueDarker, flex: 1}} />
  </Box>
)

const Container = ({backgroundColor, children}) => (
  <Box
    style={{
      backgroundColor,
      padding: isMobile ? 10 : 90,
      position: 'relative',
    }}
  >
    {children}
  </Box>
)

const groups: Array<Array<{label: string; action?: boolean; type: TextType; normalOnly?: boolean}>> = [
  [{label: 'Header big Header big', type: 'HeaderBig'}],
  [{label: 'Header big extrabold', type: 'HeaderBigExtrabold'}],
  [
    {label: 'Header Header', type: 'Header'},
    {label: 'Header Extrabold', type: 'HeaderExtrabold'},
    {action: true, label: 'Header link Header link', normalOnly: true, type: 'HeaderLink'},
  ],
  [
    {label: 'Body big Body big', type: 'BodyBig'},
    {action: true, label: 'Body big link Body big link', normalOnly: true, type: 'BodyBigLink'},
  ],
  [
    {label: 'Body text Body text Body text', type: 'Body'},
    {label: 'Body semibold Body semibold', type: 'BodySemibold'},
    {label: 'Body extrabold Body extrabold', type: 'BodyExtrabold'},
    {action: true, label: 'Body primary link', type: 'BodyPrimaryLink'},
    {action: true, label: 'Body secondary link', normalOnly: true, type: 'BodySecondaryLink'},
  ],
  [
    {label: 'Body small Body small', type: 'BodySmall'},
    {label: 'Body small bold Body small bold', type: 'BodySmallBold'},
    {label: 'Body small extrabold Body small extrabold', type: 'BodySmallExtrabold'},
    {label: 'Body small semibold', type: 'BodySmallSemibold'},
    {action: true, label: 'Body small primary link semibold', type: 'BodySmallSemiboldPrimaryLink'},
    {action: true, label: 'Body small primary link', type: 'BodySmallPrimaryLink'},
    {action: true, label: 'Body small secondary link', normalOnly: true, type: 'BodySmallSecondaryLink'},
    {
      action: true,
      label: 'Body small secondary link extrabold',
      normalOnly: true,
      type: 'BodySmallExtraboldSecondaryLink',
    },
    {label: 'Body small error Body small error', normalOnly: true, type: 'BodySmallError'},
    {label: 'Body small success Body small success', normalOnly: true, type: 'BodySmallSuccess'},
    {label: 'Body small wallet Body small wallet', normalOnly: true, type: 'BodySmallWallet'},
  ],
  [{label: 'Body tiny Body tiny', type: 'BodyTiny'}, {label: 'Body tiny semibold', type: 'BodyTinySemibold'}],
]

const mapText = (secondary: boolean) => {
  const items: Array<React.ReactNode> = []

  groups.forEach((group, gidx) => {
    group.forEach(types => {
      const item = key => (
        <Text
          type={types.type}
          onClick={types.action ? Sb.action(`${types.type} clicked`) : undefined}
          key={key}
          {...{
            ...displayBlock,
            ...(secondary ? {negative: true} : null),
            ...(secondary && types.normalOnly ? hidden : null),
          }}
        >
          {types.label}
        </Text>
      )
      items.push(item(types.type + '1'))
      items.push(item(types.type + '2'))
      items.push(<SmallGap key={types.type} />)
    })
    items.push(<LargeGap key={gidx} />)
  })

  return items
}

// prettier-ignore
const longText = ['At', 'Et', 'Itaque', 'Nam', 'Nemo', 'Quis', 'Sed', 'Temporibus', 'Ut', 'a', 'ab', 'accusamus', 'accusantium', 'ad', 'alias', 'aliquam', 'aliquid', 'amet', 'animi', 'aperiam', 'architecto', 'asperiores', 'aspernatur', 'assumenda', 'atque', 'aut', 'autem', 'beatae', 'blanditiis', 'commodi', 'consectetur', 'consequatur', 'consequatur', 'consequatur', 'consequuntur', 'corporis', 'corrupti', 'culpa', 'cum', 'cumque', 'cupiditate', 'debitis', 'delectus', 'deleniti', 'deserunt', 'dicta', 'dignissimos', 'distinctio', 'dolor', 'dolore', 'dolorem', 'doloremque', 'dolores', 'doloribus', 'dolorum', 'ducimus', 'ea', 'eaque', 'earum', 'eius', 'eligendi', 'enim', 'eos', 'eos', 'error', 'esse', 'est', 'est', 'et', 'eum', 'eveniet', 'ex', 'excepturi', 'exercitationem', 'expedita', 'explicabo', 'facere', 'facilis', 'fuga', 'fugiat', 'fugit', 'harum', 'hic', 'id', 'id', 'illo', 'illum', 'impedit', 'in', 'inventore', 'ipsa', 'ipsam', 'ipsum', 'iste', 'iure', 'iusto', 'labore', 'laboriosam', 'laborum', 'laudantium', 'libero', 'magnam', 'magni', 'maiores', 'maxime', 'minima', 'minus', 'modi', 'molestiae', 'molestias', 'mollitia', 'natus', 'necessitatibus', 'neque', 'nesciunt', 'nihil', 'nisi', 'nobis', 'non-numquam', 'non-provident', 'non-recusandae', 'nostrum', 'nulla', 'obcaecati', 'odio', 'odit', 'officia', 'officiis', 'omnis', 'optio', 'pariatur', 'perferendis', 'perspiciatis', 'placeat', 'porro', 'possimus', 'praesentium', 'quae', 'quaerat', 'quam', 'quas', 'quasi', 'qui', 'quia', 'quibusdam', 'quidem', 'quis', 'quisquam', 'quo', 'quod', 'quos', 'ratione', 'reiciendis', 'rem', 'repellat', 'repellendus', 'reprehenderit', 'repudiandae', 'rerum', 'saepe', 'sapiente', 'sed', 'sequi', 'similique', 'sint', 'sint', 'sit', 'sit', 'soluta', 'sunt', 'sunt', 'suscipit', 'tempora', 'tempore', 'tenetur', 'totam', 'ullam', 'unde', 'ut', 'vel', 'velit', 'velit', 'veniam', 'veritatis', 'vero', 'vitae', 'voluptas', 'voluptate', 'voluptatem', 'voluptatem', 'voluptatem', 'voluptates', 'voluptatibus', 'voluptatum'].join(' ')

const load = () => {
  Sb.storiesOf('Common', module)
    .addDecorator(Sb.scrollViewDecorator)
    .add('Text', () => (
      <Box style={outerStyle}>
        <Container backgroundColor={globalColors.white}>{mapText(false)}</Container>
        <Container backgroundColor={globalColors.blue}>
          <SecondaryColorBox />
          {mapText(true)}
        </Container>
      </Box>
    ))
    .add('Text all', () => (
      <>
        {Object.keys(allTextTypes).map((t: any) => (
          <Box key={t}>
            <Text type={t}>{t}</Text>
          </Box>
        ))}
      </>
    ))
    .add('Text centered', () => (
      <Box style={{backgroundColor: 'red', width: 100}}>
        <Text type="Header" center={true}>
          This is centered
        </Text>
      </Box>
    ))
    .add('Text lineclamp', () => (
      <Box style={{...globalStyles.flexBoxColumn, maxWidth: 600}}>
        <Text type="Body">Lineclamp = 1</Text>
        <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
          <Text type="BodySemibold" lineClamp={1}>
            {longText}
          </Text>
        </Box>

        <Text type="Body" style={{marginTop: globalMargins.small}}>
          Lineclamp = 1 with content to the right
        </Text>
        <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
          <Text type="BodySemibold" lineClamp={1} style={{flex: 1}}>
            {longText}
          </Text>
          <Icon type="iconfont-edit" />
        </Box>

        <Text type="Body" style={{marginTop: globalMargins.small}}>
          Lineclamp = 4
        </Text>
        <Box style={{...globalStyles.flexBoxRow, flex: 1}}>
          <Text type="BodySemibold" lineClamp={4}>
            {longText}
          </Text>
        </Box>
      </Box>
    ))
}

const outerStyle = isMobile
  ? {}
  : {display: 'grid', flex: 1, gridTemplateColumns: 'repeat(2, 1fr)', overflow: 'auto'}

export default load
