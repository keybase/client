package libkbfs

import (
	"testing"

	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol"
	"github.com/stretchr/testify/assert"

	"golang.org/x/net/context"
)

func TestParseTlfHandleEarlyFailure(t *testing.T) {
	ctx := context.Background()

	name := "w1,w2#r1"
	_, err := ParseTlfHandle(ctx, nil, name, true)
	assert.Equal(t, err, NoSuchNameError{Name: name})

	nonCanonicalName := "W1,w2#r1"
	_, err = ParseTlfHandle(ctx, nil, nonCanonicalName, false)
	assert.Equal(t, err, TlfNameNotCanonical{nonCanonicalName, name})
}

// daemonKBPKI is a hacky way to make a KBPKI instance that uses some
// methods from KeybaseDaemon.
type daemonKBPKI struct {
	KBPKI
	daemon KeybaseDaemon
}

func (d daemonKBPKI) GetCurrentUID(ctx context.Context) (keybase1.UID, error) {
	const sessionID = 0
	session, err := d.daemon.CurrentSession(ctx, sessionID)
	if err != nil {
		return keybase1.UID(""), err
	}
	return session.UID, nil
}

func (d daemonKBPKI) Resolve(ctx context.Context, assertion string) (keybase1.UID, error) {
	return d.daemon.Resolve(ctx, assertion)
}

func (d daemonKBPKI) Identify(ctx context.Context, assertion, reason string) (UserInfo, error) {
	return d.daemon.Identify(ctx, assertion, reason)
}

func (d daemonKBPKI) GetNormalizedUsername(ctx context.Context, uid keybase1.UID) (libkb.NormalizedUsername, error) {
	userInfo, err := d.daemon.LoadUserPlusKeys(ctx, uid)
	if err != nil {
		return libkb.NormalizedUsername(""), err
	}
	return userInfo.Name, nil
}

func TestParseTlfHandleNoUserFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers)

	kbpki := daemonKBPKI{
		daemon: daemon,
	}

	name := "u2,u3#u4"
	_, err := ParseTlfHandle(ctx, kbpki, name, false)
	assert.Equal(t, err, NoSuchUserError{"u4"})
}

func TestParseTlfHandleNotReaderFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers)

	kbpki := daemonKBPKI{
		daemon: daemon,
	}

	name := "u2,u3"
	_, err := ParseTlfHandle(ctx, kbpki, name, false)
	assert.Equal(t, err, ReadAccessError{"u1", name})
}

func TestParseTlfHandleAssertionNotCanonicalFailure(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	localUsers[2].Asserts = []string{"u3@twitter"}
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers)

	kbpki := daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u3"
	nonCanonicalName := "u1,u3@twitter"
	_, err := ParseTlfHandle(ctx, kbpki, nonCanonicalName, false)
	assert.Equal(t, err, TlfNameNotCanonical{nonCanonicalName, name})
}

func TestParseTlfHandleAssertionPrivateSuccess(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers)

	kbpki := daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u3"
	h, err := ParseTlfHandle(ctx, kbpki, name, false)
	assert.Nil(t, err)
	assert.Equal(t, name, h.cachedName)
}

func TestParseTlfHandleAssertionPublicSuccess(t *testing.T) {
	ctx := context.Background()

	localUsers := MakeLocalUsers([]libkb.NormalizedUsername{"u1", "u2", "u3"})
	currentUID := localUsers[0].UID
	daemon := NewKeybaseDaemonMemory(currentUID, localUsers)

	kbpki := daemonKBPKI{
		daemon: daemon,
	}

	name := "u1,u2,u3"
	h, err := ParseTlfHandle(ctx, kbpki, name, true)
	assert.Nil(t, err)
	assert.Equal(t, name+ReaderSep+PublicUIDName, h.cachedName)
}
