package xdr_test

import (
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	"testing"
)

func TestXdr(t *testing.T) {
	RegisterFailHandler(Fail)
	RunSpecs(t, "XDR Suite")
}
