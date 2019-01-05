package xdr_test

import (
	. "github.com/stellar/go/xdr"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("xdr.AccountId#Address()", func() {
	It("returns an empty string when account id is nil", func() {
		addy := (*AccountId)(nil).Address()
		Expect(addy).To(Equal(""))
	})

	It("returns a strkey string when account id is valid", func() {
		var aid AccountId
		aid.SetAddress("GCR22L3WS7TP72S4Z27YTO6JIQYDJK2KLS2TQNHK6Y7XYPA3AGT3X4FH")
		addy := aid.Address()
		Expect(addy).To(Equal("GCR22L3WS7TP72S4Z27YTO6JIQYDJK2KLS2TQNHK6Y7XYPA3AGT3X4FH"))
	})
})

var _ = Describe("xdr.AccountId#Equals()", func() {
	It("returns true when the account ids have equivalent values", func() {
		var l, r AccountId
		l.SetAddress("GCR22L3WS7TP72S4Z27YTO6JIQYDJK2KLS2TQNHK6Y7XYPA3AGT3X4FH")
		r.SetAddress("GCR22L3WS7TP72S4Z27YTO6JIQYDJK2KLS2TQNHK6Y7XYPA3AGT3X4FH")
		Expect(l.Equals(r)).To(BeTrue())
	})

	It("returns false when the account ids have different values", func() {
		var l, r AccountId
		l.SetAddress("GCR22L3WS7TP72S4Z27YTO6JIQYDJK2KLS2TQNHK6Y7XYPA3AGT3X4FH")
		r.SetAddress("GBTBXQEVDNVUEESCTPUT3CHJDVNG44EMPMBELH5F7H3YPHXPZXOTEWB4")
		Expect(l.Equals(r)).To(BeFalse())
	})
})

var _ = Describe("xdr.AccountId#LedgerKey()", func() {
	It("works", func() {
		var aid AccountId
		aid.SetAddress("GCR22L3WS7TP72S4Z27YTO6JIQYDJK2KLS2TQNHK6Y7XYPA3AGT3X4FH")

		key := aid.LedgerKey()
		packed := key.MustAccount().AccountId
		Expect(packed.Equals(aid)).To(BeTrue())
	})
})
