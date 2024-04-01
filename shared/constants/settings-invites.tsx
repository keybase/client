import * as C from '.'
import * as Z from '@/util/zustand'
import {RPCError} from '@/util/errors'
import logger from '@/logger'
import trim from 'lodash/trim'
import * as T from './types'

const settingsWaitingKey = 'settings:generic'

type InviteBase = {
  id: string
  created: T.RPCGen.Time
}

export type PendingInvite = {
  url: string
  email?: string
} & InviteBase

export type AcceptedInvite = {
  username: string
} & InviteBase

type Invitation = {
  created: number
  email?: string
  id: string
  type: string
  username: string
  uid?: string
  url: string
}

type Store = T.Immutable<{
  pendingInvites: Array<PendingInvite>
  acceptedInvites: Array<AcceptedInvite>
  error: string
}>

const initialStore: Store = {
  acceptedInvites: [],
  error: '',
  pendingInvites: [],
}

export interface State extends Store {
  dispatch: {
    loadInvites: () => void
    reclaimInvite: (inviteId: string) => void
    resetError: () => void
    resetState: 'default'
    sendInvite: (email: string, message: string) => void
  }
}

export const _useState = Z.createZustand<State>((set, get) => {
  const dispatch: State['dispatch'] = {
    loadInvites: () => {
      const f = async () => {
        const json = await T.RPCGen.apiserverGetWithSessionRpcPromise(
          {
            args: [],
            endpoint: 'invitations_sent',
          },
          settingsWaitingKey
        )
        const results: {
          invitations: Array<{
            assertion: string | undefined
            ctime: number
            email: string
            invitation_id: string
            short_code: string
            type: string
            uid: string
            username: string
          }>
        } = JSON.parse(json.body)

        const acceptedInvites: Array<Invitation> = []
        const pendingInvites: Array<Invitation> = []

        results.invitations.forEach(i => {
          const invite: Invitation = {
            created: i.ctime,
            email: i.email,
            id: i.invitation_id,
            // type will get filled in later
            type: '',
            uid: i.uid,
            // First ten chars of invite code is sufficient
            url: 'keybase.io/inv/' + i.invitation_id.slice(0, 10),
            username: i.username,
          }
          // Here's an algorithm for interpreting invitation entries.
          // 1: username+uid => accepted invite, else
          // 2: email set => pending email invite, else
          // 3: pending invitation code invite
          if (i.username && i.uid) {
            invite.type = 'accepted'
            acceptedInvites.push(invite)
          } else {
            invite.type = 'pending'
            pendingInvites.push(invite)
          }
        })
        set(s => {
          s.acceptedInvites = acceptedInvites
          s.pendingInvites = pendingInvites
        })
      }
      C.ignorePromise(f())
    },
    reclaimInvite: inviteId => {
      const f = async () => {
        try {
          await T.RPCGen.apiserverPostRpcPromise(
            {
              args: [{key: 'invitation_id', value: inviteId}],
              endpoint: 'cancel_invitation',
            },
            settingsWaitingKey
          )
        } catch (e) {
          logger.warn('Error reclaiming an invite:', e)
        }
        get().dispatch.loadInvites()
      }
      C.ignorePromise(f())
    },
    resetError: () => {
      set(s => {
        s.error = ''
      })
    },
    resetState: 'default',
    sendInvite: (email, message) => {
      const f = async () => {
        try {
          const args = [{key: 'email', value: trim(email)}]
          if (message) {
            args.push({key: 'invitation_message', value: message})
          }

          const response = await T.RPCGen.apiserverPostRpcPromise(
            {args, endpoint: 'send_invitation'},
            settingsWaitingKey
          )
          const parsedBody = JSON.parse(response.body) as undefined | Partial<{invitation_id: string}>
          const invitationId = parsedBody?.invitation_id?.slice(0, 10) ?? ''
          if (!invitationId) return
          const link = 'keybase.io/inv/' + invitationId
          set(s => {
            s.error = ''
          })
          get().dispatch.loadInvites()
          C.useRouterState.getState().dispatch.navigateAppend({props: {email, link}, selected: 'inviteSent'})
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn('Error sending an invite:', error)
          const msg = error.desc
          set(s => {
            s.error = msg
          })
          get().dispatch.loadInvites()
        }
      }
      C.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
