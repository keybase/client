package xdr

import (
	"encoding/base64"
	"fmt"
	"log"
	"strings"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"
)

// ExampleUnmarshal shows the lowest-level process to decode a base64
// envelope encoded in base64.
func ExampleUnmarshal() {
	data := "AAAAAGL8HQvQkbK2HA3WVjRrKmjX00fG8sLI7m0ERwJW/AX3AAAACgAAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAArqN6LeOagjxMaUP96Bzfs9e0corNZXzBWJkFoK7kvkwAAAAAO5rKAAAAAAAAAAABVvwF9wAAAEAKZ7IPj/46PuWU6ZOtyMosctNAkXRNX9WCAI5RnfRk+AyxDLoDZP/9l3NvsxQtWj9juQOuoBlFLnWu8intgxQA"

	rawr := strings.NewReader(data)
	b64r := base64.NewDecoder(base64.StdEncoding, rawr)

	var tx TransactionEnvelope
	bytesRead, err := Unmarshal(b64r, &tx)

	fmt.Printf("read %d bytes\n", bytesRead)

	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("This tx has %d operations\n", len(tx.Tx.Operations))
	// Output: read 192 bytes
	// This tx has 1 operations
}

var _ = Describe("xdr.SafeUnmarshal", func() {
	var (
		result int32
		data   []byte
		err    error
	)

	JustBeforeEach(func() {
		err = SafeUnmarshal(data, &result)
	})

	Context("input data is a single xdr value", func() {
		BeforeEach(func() {
			data = []byte{0x00, 0x00, 0x00, 0x01}
		})

		It("succeeds", func() {
			Expect(err).To(BeNil())
		})

		It("decodes the data correctly", func() {
			Expect(result).To(Equal(int32(1)))
		})
	})

	Context("when the input data contains more than one encoded struct", func() {
		BeforeEach(func() {
			data = []byte{
				0x00, 0x00, 0x00, 0x01,
				0x00, 0x00, 0x00, 0x01,
			}
		})
		It("errors", func() {
			Expect(err).ToNot(BeNil())
		})
	})
})

var _ = Describe("xdr.SafeUnmarshalBase64", func() {
	var (
		result int32
		data   string
		err    error
	)

	JustBeforeEach(func() {
		err = SafeUnmarshalBase64(data, &result)
	})

	Context("input data is a single xdr value", func() {
		BeforeEach(func() {
			data = "AAAAAQ=="
		})

		It("succeeds", func() {
			Expect(err).To(BeNil())
		})

		It("decodes the data correctly", func() {
			Expect(result).To(Equal(int32(1)))
		})
	})

	Context("when the input data contains more than one encoded struct", func() {
		BeforeEach(func() {
			data = "AAAAAQAAAAI="
		})
		It("errors", func() {
			Expect(err).ToNot(BeNil())
		})
	})
})
