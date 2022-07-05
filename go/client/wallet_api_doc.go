package client

const walletAPIDoc = `"keybase wallet api" provides a JSON API to the Keybase wallet.

EXAMPLES:

List the balances in all your accounts:
    {"method": "balances"}

See payment history in an account:
    {"method": "history", "params": {"options": {"account-id": "GDUKZH6Q3U5WQD4PDGZXYLJE3P76BDRDWPSALN4OUFEESI2QL5UZHCK4"}}}

Get details about a single transaction:
    {"method": "details", "params": {"options": {"txid": "e5334601b9dc2a24e031ffeec2fce37bb6a8b4b51fc711d16dec04d3e64976c4"}}}

Lookup the primary Stellar account ID for a user:
    {"method": "lookup", "params": {"options": {"name": "patrick"}}}

Get the inflation destination for an account:
    {"method": "get-inflation", "params": {"options": {"account-id": "GDUKZH6Q3U5WQD4PDGZXYLJE3P76BDRDWPSALN4OUFEESI2QL5UZHCK4"}}}

Set the inflation destination for an account to the Lumenaut pool:
    {"method": "set-inflation", "params": {"options": {"account-id": "GDUKZH6Q3U5WQD4PDGZXYLJE3P76BDRDWPSALN4OUFEESI2QL5UZHCK4", "destination": "lumenaut"}}}

Set the inflation destination for an account to some other account:
    {"method": "set-inflation", "params": {"options": {"account-id": "GDUKZH6Q3U5WQD4PDGZXYLJE3P76BDRDWPSALN4OUFEESI2QL5UZHCK4", "destination": "GD5CR6MG5R3BADYP2RUVAGC5PKCZGS4CFSAK3FYKD7WEUTRW25UH6C2J"}}}

Set the inflation destination for an account to itself:
    {"method": "set-inflation", "params": {"options": {"account-id": "GDUKZH6Q3U5WQD4PDGZXYLJE3P76BDRDWPSALN4OUFEESI2QL5UZHCK4", "destination": "self"}}}

Send XLM to a Keybase user (there is no confirmation so be careful):
    {"method": "send", "params": {"options": {"recipient": "patrick", "amount": "1"}}}

Send $10 USD worth of XLM to a Keybase user:
    {"method": "send", "params": {"options": {"recipient": "patrick", "amount": "10", "currency": "USD", "message": "here's the money I owe you"}}}

Find a payment path to a Keybase user between two assets:
    {"method": "find-payment-path", "params": {"options": {"recipient": "patrick", "amount": "10", "source-asset": "native", "destination-asset": "USD/GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX"}}}

Send 10 AnchorUSD to a Keybase user as a path payment by converting at most 120 XLM (there is no confirmation so be careful):
    {"method": "send-path-payment", "params": {"options": {"recipient": "patrick", "amount": "10", "source-max-amount": "120", "source-asset": "native", "destination-asset": "USD/GDUKMGUGDZQK6YHYA5Z6AY2G4XDSZPSZ3SW5UN3ARVMO6QSRDWP5YLEX"}}}

If you send XLM to a Keybase user who has not established a wallet yet, you can
cancel the payment before the recipient claims it and the XLM will be returned
to your account:
    {"method": "cancel", "params": {"options": {"txid": "e5334601b9dc2a24e031ffeec2fce37bb6a8b4b51fc711d16dec04d3e64976c4"}}}

Initialize the wallet for an account:
    {"method": "setup-wallet"}
`
