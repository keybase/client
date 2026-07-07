import * as Kb from '@/common-adapters'

// a wizard card choice: icon on the left, bold title over a small subtitle
const CardChoice = (props: {icon: Kb.IconType; title: string; subtitle: string; onClick: () => void}) => (
  <Kb.ListItem
    type="Card"
    firstItem={true}
    icon={<Kb.IconAuto type={props.icon} />}
    body={
      <Kb.Box2 direction="vertical" fullWidth={true}>
        <Kb.Text type="BodySemibold">{props.title}</Kb.Text>
        <Kb.Text type="BodySmall">{props.subtitle}</Kb.Text>
      </Kb.Box2>
    }
    onClick={props.onClick}
  />
)

export default CardChoice
