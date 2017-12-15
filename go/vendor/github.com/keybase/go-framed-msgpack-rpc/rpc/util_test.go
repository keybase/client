package rpc

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func testSplit(t *testing.T, prot string, method string) {
	name := makeMethodName(prot, method)

	splitProt, splitMethod := splitMethodName(name)

	require.Equal(t, prot, splitProt, "expected the protocol to match")
	require.Equal(t, method, splitMethod, "expected the method name to match")
}

func TestSplitMethodName(t *testing.T) {
	testSplit(t, "protocol.namespace.subnamespace", "method")
}

func TestSplitEmptyProtocol(t *testing.T) {
	testSplit(t, "", "method")
}
