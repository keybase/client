import * as Kb from '@/common-adapters'

// "you're in" body shown after joining an open team, also used by the
// invite-link flow
const Success = (props: {teamname: string}) => (
  <Kb.Box2 alignItems="center" direction="vertical" gap="tiny" fullWidth={true}>
    <Kb.ImageIcon type="icon-illustration-welcome-96" />
    {!!props.teamname && (
      <Kb.Text center={true} type="BodyBig">
        You’ve joined {props.teamname}!
      </Kb.Text>
    )}
    <Kb.Text center={true} type="Body">
      The team may take a tiny while to appear as an admin needs to come online. But you’re in.
    </Kb.Text>
  </Kb.Box2>
)

export default Success
