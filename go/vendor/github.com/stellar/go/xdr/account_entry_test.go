package xdr_test

import (
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	. "github.com/stellar/go/xdr"
)

var _ = Describe("xdr.AccountEntry#SignerSummary()", func() {
	const address = "GCR22L3WS7TP72S4Z27YTO6JIQYDJK2KLS2TQNHK6Y7XYPA3AGT3X4FH"
	var account AccountEntry

	BeforeEach(func() {
		account.AccountId.SetAddress(address)
	})

	It("adds the master signer when non-zero", func() {
		account.Thresholds[0] = 1
		summary := account.SignerSummary()
		Expect(summary).To(HaveKey(address))
		Expect(summary[address]).To(Equal(int32(1)))
	})

	It("doesn't have the master signer when zero", func() {
		account.Thresholds[0] = 0
		summary := account.SignerSummary()
		Expect(summary).ToNot(HaveKey(address))
	})

	It("includes every secondary signer", func() {
		account.Signers = []Signer{
			signer("GCNXDL2UN2UOZECXIO3SYDL4FSOLQXBKHKNO4EXKUNY2QBHKNF4K6VKQ", 2),
			signer("GAYLEWCV7LQBIVL7BLJ7NBYBYVKVFB55JWOQMKJQYQ3LBSXSAVFMYNHS", 4),
		}
		summary := account.SignerSummary()
		for _, signer := range account.Signers {
			addy := signer.Key.Address()
			Expect(summary).To(HaveKey(addy))
			Expect(summary[addy]).To(Equal(int32(signer.Weight)))
		}
	})
})

func signer(address string, weight int) (ret Signer) {

	ret.Key.SetAddress(address)
	ret.Weight = Uint32(weight)
	return
}
