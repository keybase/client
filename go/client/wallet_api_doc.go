package client

const walletAPIDoc = `"keybase wallet api" provides a JSON API to the Keybase wallet.

EXAMPLES:

List the balances in all your accounts:
    {"method": "balances"}

See payment history in an account:
    {"method": "history", "params": {"options": {"account-id": "GDUKZH6Q3U5WQD4PDGZXYLJE3P76BDRDWPSALN4OUFEESI2QL5UZHCK4"}}}
`
