package txnbuild

import (
	"testing"

	"github.com/stellar/go/network"
	"github.com/stretchr/testify/assert"
)

func TestAccountMergeMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	accountMerge := AccountMerge{
		Destination:   "GAS4V4O2B7DW5T7IQRPEEVCRXMDZESKISR7DVIGKZQYYV3OSQ5SH5LVP",
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&accountMerge},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAAIAAAAACXK8doPx27P6IReQlRRuweSSUiUfjqgyswxiu3Sh2R+AAAAAAAAAALqLnLFAAAAQAES8MwTufP7l2Rlbg4+1klxAeGgSyTb+vdGI7Or/Lp5xHGZwQ/KvWo0W1ot4hy+WkdJBCD1VF53skB4ZYTPFAnSh2R+AAAAQGPvZk8T2GDp2BpYGeS85VAV2UGKzyjGowt+YOfJwKbW5fjo+GLe47obXEEYxCQDZIsmwG4u5tJ9FUbjuvqi/g0="
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestAllowTrustMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	opSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	txSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	issuedAsset := CreditAsset{"ABCD", kp1.Address()}
	allowTrust := AllowTrust{
		Trustor:       kp1.Address(),
		Type:          issuedAsset,
		Authorize:     true,
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&allowTrust},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAACXK8doPx27P6IReQlRRuweSSUiUfjqgyswxiu3Sh2R+AAAAZAAiILoAAAAIAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAA4Nxt4XJcrGZRYrUvrOc1sooiQ+QdEk1suS1wo+oucsUAAAAHAAAAACXK8doPx27P6IReQlRRuweSSUiUfjqgyswxiu3Sh2R+AAAAAUFCQ0QAAAABAAAAAAAAAALqLnLFAAAAQHm+8kcSuOMVfthbNRu5ItzonA0ACvL58h4lC6K0JG6OCSR5gRbLUOMqVu1xpQZu+6t9pHwKN9QoEPoXviT3rgDSh2R+AAAAQCr0qzbX9xroeFOzliJgb7+dZJEjyZMpmF3b90NwlEWtm4KPu+U2Lvr91ImeOYtt1/UGksDlGC+3aFq3FsbKBg8="
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestBumpSequenceMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	bumpSequence := BumpSequence{
		BumpTo:        9606132444168300,
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&bumpSequence},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAALACIgugAAAGwAAAAAAAAAAuoucsUAAABA5wbLXDFQdTkJ0Oo3mkW6VrcFeylOag0urj6lKXaQV3mGdFQA4J9OezChx5DynW+FxQtuyXbSBYTcgXUADapSCdKHZH4AAABAuuYmmuuwkMBGC3oX4RA6ZkM5PfYrdUuuAhEvOnuanfyynrOgD/RPs0ROOpd7PAOuZiSkWlJZPUCaJTCo8QZdDg=="
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestChangeTrustMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	changeTrust := ChangeTrust{
		Line:          CreditAsset{"ABCD", kp0.Address()},
		Limit:         "10",
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&changeTrust},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}
	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAAGAAAAAUFCQ0QAAAAA4Nxt4XJcrGZRYrUvrOc1sooiQ+QdEk1suS1wo+oucsUAAAAABfXhAAAAAAAAAAAC6i5yxQAAAEDedJzbQLi0WzudRmn8/iRPOmY8QdhoBM23MZxTiY7A6vGsI8mvVOlWcBKL/x3czQCFFctrZzm0j2zv2Fzj/D4E0odkfgAAAEC08u+7w48yJpcR8MJmK/LKdHlD+wV8xbCo4EgSrjAlJvOXbgPPi6pV2OXHKooA6R2x58og1+uRxoRNmsNhFTwF"
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestCreateAccountMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	createAccount := CreateAccount{
		Destination:   "GCCOBXW2XQNUSL467IEILE6MMCNRR66SSVL4YQADUNYYNUVREF3FIV2Z",
		Amount:        "10",
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&createAccount},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAAAAAAAAITg3tq8G0kvnvoIhZPMYJsY+9KVV8xAA6NxhtKxIXZUAAAAAAX14QAAAAAAAAAAAuoucsUAAABANXxsuIht++BXo21iiKkj0lrhVCYNdbD/uBPbL7AXKoleT1cynaR7luA74npsMfzE9AVFr+VclOY+dzQBqIWZDNKHZH4AAABA0EQ/a/U49VgXN6kAHnxMIfy/7rATGCk+stqym2Pa6fcbIKIFyoTRVi+uPTkIcS0u1wL1FvkWuU4YbfbtUPJ5Aw=="
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestCreatePassiveSellOfferMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	createPassiveOffer := CreatePassiveSellOffer{
		Selling:       NativeAsset{},
		Buying:        CreditAsset{"ABCD", kp0.Address()},
		Amount:        "10",
		Price:         "1.0",
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&createPassiveOffer},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAAEAAAAAAAAAAFBQkNEAAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAAAX14QAAAAABAAAAAQAAAAAAAAAC6i5yxQAAAEDQA9vz3Yvc1g/xjJdkyiegE5gw4y1RmGmM6d9Kd+i7FD+i0WdGyzkxf9GjrDprUQj1/iDFGE2HpYOb5Zd5UUcP0odkfgAAAECq+9bggD7neBxaDYO4kxR/ltLjqBucqqAbYcIY7bwnGy32Ca/jvsglwnU2UgX3qhCEHSshN21bsGI/h5f+xcUH"
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestInflationMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	inflation := Inflation{
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&inflation},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAAJAAAAAAAAAALqLnLFAAAAQA10jZSBnnrqNR6RH6tbivfJropBxXa2KcH2yN9J3mBGoIxgBSyBCYEc9qKWnkrmZUGvmbTO+LNOd+PdQ4Y8CAPSh2R+AAAAQJ/b1BbMNzsXMGqGELrXH8bcEM5nXa+jq06xrMnIbgMRNRsj+NhSyKifzWP0PQQvHQ4C2yw6y+HBfWvwzAFPhQE="
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestManageDataMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	manageData := ManageData{
		Name:          "Fruit preference",
		Value:         []byte("Apple"),
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&manageData},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAAKAAAAEEZydWl0IHByZWZlcmVuY2UAAAABAAAABUFwcGxlAAAAAAAAAAAAAALqLnLFAAAAQLCtVrhLtpfRGrFhiiGJq891ewFu6ju63po2fgjnYHgA2MgSFJ5rRo3H09uIyWpcmEeeBwXihnx6Ahh9R/pDng7Sh2R+AAAAQOSrmSI0GjSDSgp0+RFwrZYBgqjVtEE5aeCebZ3KR0JCEYXwzIG/q9t1WGz5/zyd8BmmqI1+rP0R6QSp1kDyhwo="
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestManageOfferCreateMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	selling := NativeAsset{}
	buying := CreditAsset{"ABCD", kp0.Address()}
	sellAmount := "100"
	price := "0.01"
	createOffer, err := CreateOfferOp(selling, buying, sellAmount, price, &opSourceAccount)
	check(err)

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&createOffer},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAADAAAAAAAAAAFBQkNEAAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAADuaygAAAAABAAAAZAAAAAAAAAAAAAAAAAAAAALqLnLFAAAAQBo6hZfPKEWgmpWi/TCZonjsQz/w3TCCg2Qcn218b/vCq6OjTezTukCJzJZuhEI7k/STp1/dEptolP9ysGsqegjSh2R+AAAAQLAcnq3rskk4p7shyvfRLuNnK1XgOnVtvho24UW6pqflv+wRaVWJg7Vp848Gi5bBFB8mPJRYMa3lbL78n4wYJA0="
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestManageOfferDeleteMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	offerID := int64(2921622)
	deleteOffer, err := DeleteOfferOp(offerID, &opSourceAccount)
	check(err)

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&deleteOffer},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAADAAAAAAAAAAFGQUtFAAAAAEEHgGTElYZi82AkGiJdSja2OBaU2aEcwwp3AY3tFJ2xAAAAAAAAAAAAAAABAAAAAQAAAAAALJSWAAAAAAAAAALqLnLFAAAAQFp2K2fnu4AY2GsFb5BL8b8uDwCoHvcdHi+e7oedEp524sJCws4nPwEWLFu5DJcMqLCvFkr5UgwtQwFrNJmMqwbSh2R+AAAAQLtQ2CiOJOG5OsmWydFWFUads6QJj51RcJbJb0mCyDewWBpZRLmh45IMyMRlMJoxk8wKJK4UR2Sfolz7aMmjrw4="
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestManageOfferUpdateMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	selling := NativeAsset{}
	buying := CreditAsset{"ABCD", kp0.Address()}
	sellAmount := "50"
	price := "0.02"
	offerID := int64(2497628)
	updateOffer, err := UpdateOfferOp(selling, buying, sellAmount, price, offerID, &opSourceAccount)
	check(err)

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&updateOffer},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAADAAAAAAAAAAFBQkNEAAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAAB3NZQAAAAABAAAAMgAAAAAAJhxcAAAAAAAAAALqLnLFAAAAQOEvekP35V6i3XzbXLdxC5BHFg1pQkhC35KXHJKDYdXwGb5YjHh5amYL78JLtrmswu7NbpWz3MY/rbxFn+8I3gHSh2R+AAAAQLU+5Xee25nSTbRJnWx5zCtkIQ7KzDnb/V/r9nizHsizneito26JQqeEKBH/qz88d3kQxWWC4Lf053tPD6d+SA0="
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestPathPaymentMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	abcdAsset := CreditAsset{"ABCD", kp0.Address()}
	pathPayment := PathPayment{
		SendAsset:     NativeAsset{},
		SendMax:       "10",
		Destination:   kp0.Address(),
		DestAsset:     NativeAsset{},
		DestAmount:    "1",
		Path:          []Asset{abcdAsset},
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&pathPayment},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAACAAAAAAAAAAAF9eEAAAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAAAAAAAAAmJaAAAAAAQAAAAFBQkNEAAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAAAAAAALqLnLFAAAAQKYqPzdMAYo7NrrOOE2HnXRzCIBixIT9jWteNysju07WVcGpJhoLJW597UrMlsRVWLB/QJk6e6jw6SzLRDXw5wLSh2R+AAAAQMz9ZqejVTk9KiWZCv0e/hoW+F4ua2mM6tHV/kuzCB9HqVGglbK9xN0aOGnrQwvwlp824cVOYnUkV8+HfwsnQgM="

	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestPaymentMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	payment := Payment{
		Destination:   "GB7BDSZU2Y27LYNLALKKALB52WS2IZWYBDGY6EQBLEED3TJOCVMZRH7H",
		Amount:        "10",
		Asset:         NativeAsset{},
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&payment},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAABAAAAAH4RyzTWNfXhqwLUoCw91aWkZtgIzY8SAVkIPc0uFVmYAAAAAAAAAAAF9eEAAAAAAAAAAALqLnLFAAAAQHzYkZeogiHztanqRvrXXxiNShH/Zf5EUjgabrb6wwgX1eOUBRjp5J92qq8s/o1B1sxrMNiPpViAq40tD/yGfwjSh2R+AAAAQNVC6YLIbAnFs3G/rdf7IxrWYFOxjOKUSZsN0q1Bm/MXk+7ydhcCbYBgq+VGa6eZf8BckgIdAtDI8VNWPoTyhAM="
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}

func TestSetOptionsMultSigners(t *testing.T) {
	kp0 := newKeypair0()
	txSourceAccount := NewSimpleAccount(kp0.Address(), int64(9605939170639898))

	kp1 := newKeypair1()
	opSourceAccount := NewSimpleAccount(kp1.Address(), int64(9606132444168199))

	setOptions := SetOptions{
		SetFlags:      []AccountFlag{AuthRequired, AuthRevocable},
		SourceAccount: &opSourceAccount,
	}

	tx := Transaction{
		SourceAccount: &txSourceAccount,
		Operations:    []Operation{&setOptions},
		Timebounds:    NewInfiniteTimeout(),
		Network:       network.TestNetworkPassphrase,
	}

	received := buildSignEncode(t, tx, kp0, kp1)
	expected := "AAAAAODcbeFyXKxmUWK1L6znNbKKIkPkHRJNbLktcKPqLnLFAAAAZAAiII0AAAAbAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAAAAAJcrx2g/Hbs/ohF5CVFG7B5JJSJR+OqDKzDGK7dKHZH4AAAAFAAAAAAAAAAAAAAABAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC6i5yxQAAAEA7Wgrkr6q1o1Cf9rzfopqkIUQWD9Se3TagU2GhMn9OjGT75flGAaOdQ+kHLDGQjThDKMMdB8jCJGe8IGc/dIQP0odkfgAAAEDni8seENXmyh0QgHkLjM4EmhHmBr5NvU6VpJaVBfv631yaaHP7lONfg9x8DyHjz8uh03S7ipShHIrQDFN+L+cM"
	assert.Equal(t, expected, received, "Base 64 XDR should match")
}
