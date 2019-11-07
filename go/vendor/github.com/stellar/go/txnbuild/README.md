# txnbuild

`txnbuild` is a [Stellar SDK](https://www.stellar.org/developers/reference/), implemented in [Go](https://golang.org/). It provides a reference implementation of the complete [set of operations](https://www.stellar.org/developers/guides/concepts/list-of-operations.html) that compose [transactions](https://www.stellar.org/developers/guides/concepts/transactions.html) for the Stellar distributed ledger.

This project is maintained by the Stellar Development Foundation.

```golang
  import (
	"log"

	"github.com/stellar/go/clients/horizonclient"
	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	"github.com/stellar/go/txnbuild"
	)

	// Make a keypair for a known account from a secret seed
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")

	// Get the current state of the account from the network
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
  	if err != nil {
    		log.Println(err)
  	}

	// Build an operation to create and fund a new account
	op := txnbuild.CreateAccount{
		Destination: "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z",
		Amount:      "10",
	}

	// Construct the transaction that holds the operations to execute on the network
	tx := txnbuild.Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []txnbuild.Operation{&op},
		Timebounds:    txnbuild.NewTimeout(300),
		Network:       network.TestNetworkPassphrase,
	}

	// Serialise, sign and encode the transaction
	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
  	if err != nil {
    		log.Println(err)
  	}

	// Send the transaction to the network
	resp, err := client.SubmitTransactionXDR(txe)
  	if err != nil {
    		log.Println(err)
  	}
```

## Getting Started
This library is aimed at developers building Go applications on top of the [Stellar network](https://www.stellar.org/). Transactions constructed by this library may be submitted to any Horizon instance for processing onto the ledger, using any Stellar SDK client. The recommended client for Go programmers is [horizonclient](https://github.com/stellar/go/tree/master/clients/horizonclient). Together, these two libraries provide a complete Stellar SDK.

* The [txnbuild API reference](https://godoc.org/github.com/stellar/go/txnbuild).
* The [horizonclient API reference](https://godoc.org/github.com/stellar/go/clients/horizonclient).

An easy-to-follow demonstration that exercises this SDK on the TestNet with actual accounts is also included! See the [Demo](#demo) section below.

### Prerequisites
* Go 1.12 or greater
* [Modules](https://github.com/golang/go/wiki/Modules) to manage dependencies

### Installing
* `go get github.com/stellar/go/clients/txnbuild`

## Running the tests
Run the unit tests from the package directory: `go test`

## Demo
To see the SDK in action, build and run the demo:
* Enter the demo directory: `cd $GOPATH/src/github.com/stellar/go/txnbuild/cmd/demo`
* Build the demo: `go build`
* Run the demo: `./demo init`


## Contributing
Please read [Code of Conduct](https://github.com/stellar/.github/blob/master/CODE_OF_CONDUCT.md) to understand this project's communication rules.

To submit improvements and fixes to this library, please see [CONTRIBUTING](../CONTRIBUTING.md).

## License
This project is licensed under the Apache License - see the [LICENSE](../../LICENSE-APACHE.txt) file for details.
