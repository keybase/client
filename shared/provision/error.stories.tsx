import type {Meta, StoryObj} from '@storybook/react'
import * as T from '@/constants/types'
import RenderError from './error'
import type {ProvisionRouteError} from '@/stores/provision'

const makeError = (overrides: Partial<ProvisionRouteError> = {}): ProvisionRouteError => ({
  code: T.RPCGen.StatusCode.scgeneric,
  desc: 'Something went wrong.',
  details: '',
  message: 'Generic error',
  ...overrides,
})

const meta: Meta<typeof RenderError> = {
  component: RenderError,
  title: 'Provision/Error',
}
export default meta
type Story = StoryObj<typeof RenderError>

export const NoError: Story = {
  args: {
    route: {params: {}},
  },
}

export const GenericError: Story = {
  args: {
    route: {
      params: {
        error: makeError({desc: 'Is the other device using the username you expect? It seems to be different.'}),
      },
    },
  },
}

export const Offline: Story = {
  args: {
    route: {
      params: {
        error: makeError({code: T.RPCGen.StatusCode.scdeviceprovisionoffline}),
      },
    },
  },
}

export const BadPassword: Story = {
  args: {
    route: {
      params: {
        error: makeError({code: T.RPCGen.StatusCode.scbadloginpassword}),
      },
    },
  },
}

export const NoProvision: Story = {
  args: {
    route: {
      params: {
        error: makeError({code: T.RPCGen.StatusCode.scdevicenoprovision}),
      },
    },
  },
}

export const Deleted: Story = {
  args: {
    route: {
      params: {
        error: makeError({code: T.RPCGen.StatusCode.scdeleted}),
      },
    },
  },
}
