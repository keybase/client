import type * as React from 'react'
import type {Meta, StoryObj} from '@storybook/react'
import * as Styles from '@/styles'
import type {ModalSize} from '@/constants/types/router'
import {Box2} from './box'
import ConfirmButtons from './confirm-buttons'
import Input3 from './input3'
import ModalHeaderTitle from './modal-header-title'
import ModalScreen from './modal-screen'
import {ModalBoxContext} from './modal-box'
import ScrollView from './scroll-view'
import Text from './text'

// A stand-in for the desktop modal box (router-v2/screen-layout-modal.desktop.tsx): the sized
// frame, its clip box and the 48px header, with ModalBoxContext set as the route layout sets it.
const sizes = {
  medium: {height: 'min(560px, 85vh)', width: 560},
  small: {maxHeight: 'min(560px, 85vh)', width: 400},
} as const

const Frame = (p: {children: React.ReactNode; size: Exclude<ModalSize, 'large'>; title: string; subtitle?: string}) => {
  const {children, size, title, subtitle} = p
  const styles = useStyles()
  return (
    <Box2 direction="vertical" style={styles.backdrop} alignItems="center">
      <Box2 direction="vertical" style={Styles.collapseStyles([styles.frame, sizes[size]])}>
        <Box2 direction="vertical" style={styles.clip}>
          <Box2 direction="horizontal" fullWidth={true} centerChildren={true} noShrink={true} style={styles.header}>
            <ModalHeaderTitle title={title} subtitle={subtitle} />
          </Box2>
          <ModalBoxContext value={{size}}>{children}</ModalBoxContext>
        </Box2>
      </Box2>
    </Box2>
  )
}

const paragraphs = (n: number) =>
  Array.from({length: n}, (_, i) => (
    <Text key={i} type="Body">
      Paragraph {i + 1}. The body of a modal scrolls inside the box, so the header and the footer stay in
      view however long it gets.
    </Text>
  ))

// the screen's own scroller, as a list body brings
const ChannelList = () => {
  const styles = useStyles()
  return (
    <ScrollView style={styles.list}>
      {Array.from({length: 40}, (_, i) => (
        <Box2 key={i} direction="horizontal" fullWidth={true} padding="small">
          <Text type="BodySemibold">#channel-{i + 1}</Text>
        </Box2>
      ))}
    </ScrollView>
  )
}

const footer = <ConfirmButtons split={true} confirmLabel="Save" onCancel={() => {}} onConfirm={() => {}} />

const meta: Meta = {title: 'Common/ModalScreen'}
export default meta
type Story = StoryObj

export const SmallShort: Story = {
  render: () => (
    <Frame size="small" title="Leave team">
      <ModalScreen centered={true}>
        <Text type="BodyBig" center={true}>
          Are you sure you want to leave acme?
        </Text>
      </ModalScreen>
    </Frame>
  ),
}

export const SmallOverflowing: Story = {
  render: () => (
    <Frame size="small" title="Terms">
      <ModalScreen>
        <Box2 direction="vertical" gap="small" fullWidth={true}>
          {paragraphs(20)}
        </Box2>
      </ModalScreen>
    </Frame>
  ),
}

export const MediumForm: Story = {
  render: () => (
    <Frame size="medium" title="Edit team info" subtitle="acme">
      <ModalScreen>
        <Box2 direction="vertical" gap="small" fullWidth={true}>
          <Input3 placeholder="Team name" value="acme" onChangeText={() => {}} />
          <Input3 placeholder="Description" multiline={true} rowsMin={3} onChangeText={() => {}} />
        </Box2>
      </ModalScreen>
    </Frame>
  ),
}

export const MediumList: Story = {
  render: () => (
    <Frame size="medium" title="Add to channels" subtitle="acme">
      <ModalScreen scroll={false} padding="none">
        <ChannelList />
      </ModalScreen>
    </Frame>
  ),
}

export const WithFooter: Story = {
  render: () => (
    <Frame size="small" title="Rename subteam">
      <ModalScreen footer={footer}>
        <Box2 direction="vertical" gap="small" fullWidth={true}>
          {paragraphs(2)}
          <Input3 placeholder="New name" value="acme.design" onChangeText={() => {}} />
        </Box2>
      </ModalScreen>
    </Frame>
  ),
}

const useStyles = Styles.createStyleHook(theme => ({
  backdrop: {backgroundColor: theme.black_50, padding: Styles.globalMargins.large},
  clip: {
    borderRadius: Styles.borderRadius,
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
    overflow: 'hidden',
  },
  frame: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.boxShadow,
      backgroundColor: theme.white,
      borderRadius: Styles.borderRadius,
      position: 'relative',
    },
  }),
  header: {...Styles.bottomDivider(theme), height: 48},
  list: {flexGrow: 1},
}))
