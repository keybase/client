package txnbuild

import (
	"fmt"
	"time"

	"github.com/stellar/go/keypair"
	"github.com/stellar/go/network"
	horizonclient "github.com/stellar/go/txnbuild/examplehorizonclient"
)

func ExampleInflation() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := Inflation{}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAJAAAAAAAAAAHqLnLFAAAAQP3NHWXvzKIHB3+jjhHITdc/tBPntWYj3SoTjpON+dxjKqU5ohFamSHeqi5ONXkhE9Uajr5sVZXjQfUcTTzsWAA=
}

func ExampleCreateAccount() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := CreateAccount{
		Destination: "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z",
		Amount:      "10",
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAITg3tq8G0kvnvoIhZPMYJsY+9KVV8xAA6NxhtKxIXZUAAAAAAX14QAAAAAAAAAAAeoucsUAAABAqyuXG3pGL9a4MZwrX5OTWF1gd094rsowh2zXSZzDPDoGlAVljE/yjo7p6MkUY7TpMAa3Y+iXC5ael6JVD0pyDQ==
}

func ExamplePayment() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := Payment{
		Destination: "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z",
		Amount:      "10",
		Asset:       NativeAsset{},
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAABAAAAAITg3tq8G0kvnvoIhZPMYJsY+9KVV8xAA6NxhtKxIXZUAAAAAAAAAAAF9eEAAAAAAAAAAAHqLnLFAAAAQHb8LTro4QVpzcGzOToW28p340o54KX5/xxodABM+izweQlbVKb9bISRUOu+sNfi50weXeAeGVL+oTQS5YR4lgI=
}

func ExamplePayment_setBaseFee() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op1 := Payment{
		Destination: "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z",
		Amount:      "10",
		Asset:       NativeAsset{},
	}

	op2 := Payment{
		Destination: "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z",
		Amount:      "100",
		Asset:       NativeAsset{},
	}

	// get fees from network
	feeStats, err := client.FeeStats()
	check(err)

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op1, &op2},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
		BaseFee:       uint32(feeStats.P50AcceptedFee),
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAEsAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAABAAAAAITg3tq8G0kvnvoIhZPMYJsY+9KVV8xAA6NxhtKxIXZUAAAAAAAAAAAF9eEAAAAAAAAAAAEAAAAAhODe2rwbSS+e+giFk8xgmxj70pVXzEADo3GG0rEhdlQAAAAAAAAAADuaygAAAAAAAAAAAeoucsUAAABAyY5c/6T3cQ1i27t681O7aHrdSQ2tCcXpyLj06HVe59DeuHNLgN3X7oBeqBZrgVty+VNVGPEK6uR+UjhGi/bGBA==
}

func ExampleBumpSequence() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := BumpSequence{
		BumpTo: 9606132444168300,
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAALACIgugAAAGwAAAAAAAAAAeoucsUAAABAQi/I4d0+fzZyQpchIYXqxHhhTmjHvfmK8qsL/BLjrXmPUADja9tdIupKEkDn/v8NfnpRS/4u3u+Vy70zuOxHDg==
}

func ExampleAccountMerge() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := AccountMerge{
		Destination: "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z",
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAIAAAAAITg3tq8G0kvnvoIhZPMYJsY+9KVV8xAA6NxhtKxIXZUAAAAAAAAAAHqLnLFAAAAQC87HdYfOZpOx/isr7JEOy9ef3GH51ToKSkC6b4UJdDktlCqHFCD0cSttJ/F5MUx2ScSkwpeAlEVR8B62X6N/g4=
}

func ExampleManageData() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := ManageData{
		Name:  "Fruit preference",
		Value: []byte("Apple"),
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAKAAAAEEZydWl0IHByZWZlcmVuY2UAAAABAAAABUFwcGxlAAAAAAAAAAAAAAHqLnLFAAAAQO1ELJBEoqBDyIsS7uSJwe1LOimV/E+09MyF1G/+yrxSggFVPEjD5LXcm/6POze3IsMuIYJU1et5Q2Vt9f73zQo=
}

func ExampleManageData_removeDataEntry() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := ManageData{
		Name: "Fruit preference",
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAKAAAAEEZydWl0IHByZWZlcmVuY2UAAAAAAAAAAAAAAAHqLnLFAAAAQMWkjW+mHMbwOfLhpUMDu3I6U/nv132RY7RT++arqlZOs2hx3r7FOJTvndbnSSwSxwDp/VY3BSxB/4MLCZl+ogA=
}

func ExampleSetOptions() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := SetOptions{
		InflationDestination: NewInflationDestination("GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z"),
		ClearFlags:           []AccountFlag{AuthRevocable},
		SetFlags:             []AccountFlag{AuthRequired, AuthImmutable},
		MasterWeight:         NewThreshold(10),
		LowThreshold:         NewThreshold(1),
		MediumThreshold:      NewThreshold(2),
		HighThreshold:        NewThreshold(2),
		HomeDomain:           NewHomeDomain("LovelyLumensLookLuminous.com"),
		Signer:               &Signer{Address: "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z", Weight: Threshold(4)},
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAFAAAAAQAAAACE4N7avBtJL576CIWTzGCbGPvSlVfMQAOjcYbSsSF2VAAAAAEAAAACAAAAAQAAAAUAAAABAAAACgAAAAEAAAABAAAAAQAAAAIAAAABAAAAAgAAAAEAAAAcTG92ZWx5THVtZW5zTG9va0x1bWlub3VzLmNvbQAAAAEAAAAAhODe2rwbSS+e+giFk8xgmxj70pVXzEADo3GG0rEhdlQAAAAEAAAAAAAAAAHqLnLFAAAAQHGdxG4uiB41Dywb1OiNQwHpCYoNZiaEXTRbPjdRf3SkBCdI1wkBDG6vREDsWfouMks5urKNx0hzg/YMLTa7TwY=
}

func ExampleChangeTrust() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := ChangeTrust{
		Line:  CreditAsset{"ABCD", "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z"},
		Limit: "10",
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAGAAAAAUFCQ0QAAAAAhODe2rwbSS+e+giFk8xgmxj70pVXzEADo3GG0rEhdlQAAAAABfXhAAAAAAAAAAAB6i5yxQAAAECqpS4iUUyuUSVicZIseVoj8DjWgYDet21zUQeHNr1teTflnCUS+awFQ5lNqxl+AHPB34JzN6RYoEISoEIfNpIH
}

func ExampleChangeTrust_removeTrustline() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := RemoveTrustlineOp(CreditAsset{"ABCD", "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z"})

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAGAAAAAUFCQ0QAAAAAhODe2rwbSS+e+giFk8xgmxj70pVXzEADo3GG0rEhdlQAAAAAAAAAAAAAAAAAAAAB6i5yxQAAAEAouZRZwuPF5j68byMRcw2mtToS6nFsxGJcZjO4oGm2dWVsVS1MGqFhr+JvIJlMRUKKdPxtZAoO9kjSbpUspUcC
}

func ExampleAllowTrust() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := AllowTrust{
		Trustor:   "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z",
		Type:      CreditAsset{"ABCD", "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z"},
		Authorize: true,
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAHAAAAAITg3tq8G0kvnvoIhZPMYJsY+9KVV8xAA6NxhtKxIXZUAAAAAUFCQ0QAAAABAAAAAAAAAAHqLnLFAAAAQBjcydaIxwvXxLFEhNK4jm1lJeYSjRDfxRmDSOIkZTZTqRKewI1NMmIYAIZCUis98Axi32ShqutfXXDscsGixA0=
}

func ExampleManageSellOffer() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	selling := NativeAsset{}
	buying := CreditAsset{"ABCD", "GAS4V4O2B7DW5T7IQRPEEVCRXMDZESKISR7DVIGKZQYYV3OSQ5SH5LVP"}
	sellAmount := "100"
	price := "0.01"
	op, err := CreateOfferOp(selling, buying, sellAmount, price)
	check(err)

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAADAAAAAAAAAAFBQkNEAAAAACXK8doPx27P6IReQlRRuweSSUiUfjqgyswxiu3Sh2R+AAAAADuaygAAAAABAAAAZAAAAAAAAAAAAAAAAAAAAAHqLnLFAAAAQG1+s35VQTuILAGTT6uaDT9RrgMi0xYTLqdoZbGgMGLiSwIglJk/OS/v1DrmshoXIhwL/O7Ilychy/vcA/4dAQo=
}

func ExampleManageSellOffer_deleteOffer() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	offerID := int64(2921622)
	op, err := DeleteOfferOp(offerID)
	check(err)

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAADAAAAAAAAAAFGQUtFAAAAAEEHgGTElYZi82AkGiJdSja2OBaU2aEcwwp3AY3tFJ2xAAAAAAAAAAAAAAABAAAAAQAAAAAALJSWAAAAAAAAAAHqLnLFAAAAQGcT6ggtq6q3qbx+PsMgE1b9cGYonfhIu8d3E/Ti9vbpojyr2L/an3+kkydY946gjDR/qOt5HfTqo8kWGMy2XgY=
}

func ExampleManageSellOffer_updateOffer() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	selling := NativeAsset{}
	buying := CreditAsset{"ABCD", "GAS4V4O2B7DW5T7IQRPEEVCRXMDZESKISR7DVIGKZQYYV3OSQ5SH5LVP"}
	sellAmount := "50"
	price := "0.02"
	offerID := int64(2497628)
	op, err := UpdateOfferOp(selling, buying, sellAmount, price, offerID)
	check(err)

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAADAAAAAAAAAAFBQkNEAAAAACXK8doPx27P6IReQlRRuweSSUiUfjqgyswxiu3Sh2R+AAAAAB3NZQAAAAABAAAAMgAAAAAAJhxcAAAAAAAAAAHqLnLFAAAAQKY77jK6QC4tG1HghFY9W2jJnYsl5qKk+55z78zUkYOhMU9QsOXeSC6A/BXeavSO8w0CsF1HxLc1TDfWC1PlNw4=
}

func ExampleCreatePassiveSellOffer() {
	kp, _ := keypair.Parse("SBPQUZ6G4FZNWFHKUWC5BEYWF6R52E3SEP7R3GWYSM2XTKGF5LNTWW4R")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	op := CreatePassiveSellOffer{
		Selling: NativeAsset{},
		Buying:  CreditAsset{"ABCD", "GAS4V4O2B7DW5T7IQRPEEVCRXMDZESKISR7DVIGKZQYYV3OSQ5SH5LVP"},
		Amount:  "10",
		Price:   "1.0",
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAEAAAAAAAAAAFBQkNEAAAAACXK8doPx27P6IReQlRRuweSSUiUfjqgyswxiu3Sh2R+AAAAAAX14QAAAAABAAAAAQAAAAAAAAAB6i5yxQAAAEAThdst0NXPUzAL0GzzieSoryHIeF5VtjOc1KIA/SGI/xq69woAydjPccm/MzwfSr8rkw++AFp6Edn+1C1o9IYG
}

func ExamplePathPayment() {
	kp, _ := keypair.Parse("SBZVMB74Z76QZ3ZOY7UTDFYKMEGKW5XFJEB6PFKBF4UYSSWHG4EDH7PY")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	abcdAsset := CreditAsset{"ABCD", "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3"}
	op := PathPayment{
		SendAsset:   NativeAsset{},
		SendMax:     "10",
		Destination: kp.Address(),
		DestAsset:   NativeAsset{},
		DestAmount:  "1",
		Path:        []Asset{abcdAsset},
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&op},
		Timebounds:    NewInfiniteTimeout(), // Use a real timeout in production!
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAH4RyzTWNfXhqwLUoCw91aWkZtgIzY8SAVkIPc0uFVmYAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAACAAAAAAAAAAAF9eEAAAAAAH4RyzTWNfXhqwLUoCw91aWkZtgIzY8SAVkIPc0uFVmYAAAAAAAAAAAAmJaAAAAAAQAAAAFBQkNEAAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAAAAAAAEuFVmYAAAAQOGE+w2bvIp8JQIPIFXWk5kO77cNUOlPZwlItA5V68/qmZTbJWq8wqdZtjELkZtNcQQX4x8EToShbn5nitG3RA4=
}

func ExampleManageBuyOffer() {
	kp, _ := keypair.Parse("SBZVMB74Z76QZ3ZOY7UTDFYKMEGKW5XFJEB6PFKBF4UYSSWHG4EDH7PY")
	client := horizonclient.DefaultTestNetClient
	ar := horizonclient.AccountRequest{AccountID: kp.Address()}
	sourceAccount, err := client.AccountDetail(ar)
	check(err)

	buyOffer := ManageBuyOffer{
		Selling: NativeAsset{},
		Buying:  CreditAsset{"ABCD", "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3"},
		Amount:  "100",
		Price:   "0.01",
		OfferID: 0,
	}

	tx := Transaction{
		SourceAccount: &sourceAccount,
		Operations:    []Operation{&buyOffer},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	txe, err := tx.BuildSignEncode(kp.(*keypair.Full))
	check(err)
	fmt.Println(txe)

	// Output: AAAAAH4RyzTWNfXhqwLUoCw91aWkZtgIzY8SAVkIPc0uFVmYAAAAZAAMoj8AAAAEAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAMAAAAAAAAAAFBQkNEAAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAADuaygAAAAABAAAAZAAAAAAAAAAAAAAAAAAAAAEuFVmYAAAAQPh8h1TrzDpcgzB/VE8V0X2pFGV8/JyuYrx0I5bRfBJuLJr0l8yL1isP1wZjvMdX7fNiktwSLuUuj749nWA6wAo=

}

func ExampleBuildChallengeTx() {
	// Generate random nonce
	serverSignerSeed := "SBZVMB74Z76QZ3ZOY7UTDFYKMEGKW5XFJEB6PFKBF4UYSSWHG4EDH7PY"
	clientAccountID := "GDQNY3PBOJOKYZSRMK2S7LHHGWZIUISD4QORETLMXEWXBI7KFZZMKTL3"
	anchorName := "SDF"
	timebound := time.Duration(5 * time.Minute)

	tx, err := BuildChallengeTx(serverSignerSeed, clientAccountID, anchorName, network.TestNetworkPassphrase, timebound)
	_, err = checkChallengeTx(tx, anchorName)

	check(err)
}
