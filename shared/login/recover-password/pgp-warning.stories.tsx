import type {Meta, StoryObj} from '@storybook/react'
import PgpWarning from './pgp-warning'

const meta: Meta<typeof PgpWarning> = {
  component: PgpWarning,
  title: 'Login/RecoverPasswordPgpWarning',
}
export default meta
type Story = StoryObj<typeof PgpWarning>

export const Default: Story = {args: {route: {params: {id: 0}}}}
