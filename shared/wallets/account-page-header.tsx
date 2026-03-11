import * as Kb from '@/common-adapters'

// Component to show page title on desktop
// And account name / title like this on mobile:
//    account-name
//       title

type Props = {
  accountName?: string
  title: string
}

const AccountPageHeader = (props: Props) => (
  <Kb.Box2 direction="horizontal" centerChildren={true} flex={1}>
    <Kb.Box2 direction="vertical">
      {Kb.Styles.isMobile && !!props.accountName && (
        <Kb.Text center={true} type="BodySmallSemibold">
          {props.accountName}
        </Kb.Text>
      )}
      <Kb.Text center={true} type="BodyBig">
        {props.title}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

export default AccountPageHeader
