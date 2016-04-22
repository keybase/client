package libkbfs

import (
	"fmt"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol"
	"golang.org/x/net/context"
)

type testNormalizedUsernameGetter struct{}

var _ normalizedUsernameGetter = testNormalizedUsernameGetter{}

func (testNormalizedUsernameGetter) GetNormalizedUsername(ctx context.Context, uid keybase1.UID) (libkb.NormalizedUsername, error) {
	return libkb.NormalizedUsername(fmt.Sprintf("user_%s", uid)), nil
}

func makeTestTlfHandle(
	t logger.TestLogBackend, x uint32, public bool,
	unresolvedWriters, unresolvedReaders []keybase1.SocialAssertion) *TlfHandle {
	uid := keybase1.MakeTestUID(x)
	var readers []keybase1.UID
	if public {
		readers = []keybase1.UID{keybase1.PUBLIC_UID}
	}
	bareH, err := MakeBareTlfHandle(
		[]keybase1.UID{uid}, readers,
		unresolvedWriters, unresolvedReaders)
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	h, err := MakeTlfHandle(ctx, bareH, testNormalizedUsernameGetter{})
	if err != nil {
		t.Fatal(err)
	}
	return h
}
