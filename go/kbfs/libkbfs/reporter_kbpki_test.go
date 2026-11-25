// Copyright 2026 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"context"
	"testing"

	"github.com/keybase/client/go/kbfs/kbfsblock"
	"github.com/keybase/client/go/kbfs/kbfsmd"
	"github.com/keybase/client/go/kbfs/tlf"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestReporterKBPKIServerWriteRefusal(t *testing.T) {
	ctx := context.Background()
	config := MakeTestConfigOrBust(t, "alice")
	defer CheckConfigAndShutdown(ctx, t, config)
	// No send goroutine, so the notification stays in the buffer.
	r := &ReporterKBPKI{
		ReporterSimple: NewReporterSimple(config.Clock(), 2),
		config:         config,
		notifyBuffer:   make(chan *keybase1.FSNotification, 1),
	}

	for _, err := range []error{
		kbfsblock.ServerErrorNoPermission{},
		kbfsmd.ServerErrorWriteAccess{},
	} {
		r.ReportErr(ctx, "alice", tlf.Public, WriteMode, errors.WithStack(err))
		select {
		case n := <-r.notifyBuffer:
			require.Equal(t, keybase1.FSErrorType_ACCESS_DENIED, n.ErrorType)
			require.Equal(t, "/keybase/public/alice", n.Filename)
			require.Equal(t, errorModeWrite, n.Params[errorParamMode])
		default:
			require.FailNow(t, "no notification", "%T", err)
		}
	}
}
