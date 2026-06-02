import type {Meta, StoryObj} from '@storybook/react'
import Text from './text'
import {Box2} from './box'
import * as Styles from '@/styles'

const meta: Meta<typeof Text> = {
  component: Text,
  title: 'CommonAdapters/Text',
  args: {type: 'Body', children: 'The quick brown fox jumps over the lazy dog'},
}
export default meta
type Story = StoryObj<typeof Text>

export const Body: Story = {
  args: {type: 'Body', children: 'Body text — used for standard content.'},
}

export const BodySmall: Story = {
  args: {type: 'BodySmall', children: 'BodySmall — secondary information or metadata.'},
}

export const BodySemibold: Story = {
  args: {type: 'BodySemibold', children: 'BodySemibold — slightly emphasized content.'},
}

export const Header: Story = {
  args: {type: 'Header', children: 'Header — section titles and dialog headings.'},
}

export const HeaderBig: Story = {
  args: {type: 'HeaderBig', children: 'HeaderBig — page-level headings.'},
}

export const BodyPrimaryLink: Story = {
  args: {type: 'BodyPrimaryLink', children: 'Primary link text', onClick: () => {}},
}

export const BodySmallError: Story = {
  args: {type: 'BodySmallError', children: 'Something went wrong.'},
}

export const BodyTiny: Story = {
  args: {type: 'BodyTiny', children: 'BodyTiny — captions and fine print.'},
}

export const Negative: Story = {
  args: {type: 'Body', children: 'Negative (light text for dark backgrounds)', negative: true},
  decorators: [
    Story => (
      <Box2 direction="vertical" style={{backgroundColor: Styles.globalColors.black, padding: Styles.globalMargins.medium}}>
        <Story />
      </Box2>
    ),
  ],
}

export const LineClamp: Story = {
  args: {
    type: 'Body',
    children: 'This is a very long string that will be clamped to a single line because it exceeds the available width in most containers and we want to demonstrate the lineClamp feature.',
    lineClamp: 1,
    style: {maxWidth: 300},
  },
}

export const TypeShowcase: Story = {
  render: () => (
    <Box2 direction="vertical" gap="small" style={{padding: Styles.globalMargins.medium}}>
      {(['HeaderBig', 'Header', 'Body', 'BodySemibold', 'BodySmall', 'BodyTiny'] as const).map(type => (
        <Text key={type} type={type}>{type}: The quick brown fox</Text>
      ))}
    </Box2>
  ),
}
