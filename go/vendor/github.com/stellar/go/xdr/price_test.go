package xdr_test

import (
	. "github.com/stellar/go/xdr"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

var _ = Describe("xdr.Price", func() {
	Context("Price.Invert", func() {
		price := Price{N: 1, D: 2}

		It("succeeds", func() {
			price.Invert()

			Expect(price.N).To(Equal(Int32(2)))
			Expect(price.D).To(Equal(Int32(1)))
		})
	})
})
