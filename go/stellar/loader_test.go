package stellar

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/stellar1"
	"github.com/stretchr/testify/require"
)

func TestLoaderClean(t *testing.T) {
	tc := libkb.SetupTest(t, "loaderclean", 1)
	defer tc.Cleanup()

	loader := NewLoader(tc.G)
	require.Equal(t, 0, loader.PaymentsLen())
	require.Equal(t, 0, loader.RequestsLen())

	// clean of empty should work
	n := loader.cleanPayments(50)
	require.Equal(t, 0, n)
	require.Equal(t, 0, loader.PaymentsLen())
	n = loader.cleanRequests(40)
	require.Equal(t, 0, n)
	require.Equal(t, 0, loader.RequestsLen())

	for i := 0; i < 10; i++ {
		addRandomPayment(t, loader)
		addRandomRequest(t, loader)
	}

	// clean below limit shouldn't do anything
	n = loader.cleanPayments(50)
	require.Equal(t, 0, n)
	require.Equal(t, 10, loader.PaymentsLen())
	n = loader.cleanRequests(40)
	require.Equal(t, 0, n)
	require.Equal(t, 10, loader.RequestsLen())

	for i := 0; i < 100; i++ {
		addRandomPayment(t, loader)
		addRandomRequest(t, loader)
	}

	require.Equal(t, 110, loader.PaymentsLen())
	require.Equal(t, 110, loader.RequestsLen())

	// clean above limit should clean
	n = loader.cleanPayments(50)
	require.Equal(t, 60, n)
	require.Equal(t, 50, loader.PaymentsLen())
	n = loader.cleanRequests(40)
	require.Equal(t, 70, n)
	require.Equal(t, 40, loader.RequestsLen())

	// make sure clean works more than one time:
	for i := 0; i < 10; i++ {
		addRandomPayment(t, loader)
		addRandomRequest(t, loader)
	}

	require.Equal(t, 60, loader.PaymentsLen())
	require.Equal(t, 50, loader.RequestsLen())

	n = loader.cleanPayments(50)
	require.Equal(t, 10, n)
	require.Equal(t, 50, loader.PaymentsLen())

	n = loader.cleanRequests(40)
	require.Equal(t, 10, n)
	require.Equal(t, 40, loader.RequestsLen())
}

func addRandomPayment(t *testing.T, loader *Loader) {
	id, err := libkb.RandString("", 16)
	if err != nil {
		t.Fatal(err)
	}
	pid := stellar1.PaymentID(id)
	loader.storePayment(pid, &stellar1.PaymentLocal{Id: pid})
}

func addRandomRequest(t *testing.T, loader *Loader) {
	id, err := libkb.RandString("", 16)
	if err != nil {
		t.Fatal(err)
	}
	rid := stellar1.KeybaseRequestID(id)
	loader.storeRequest(rid, &stellar1.RequestDetailsLocal{Id: rid})
}
