package chat

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/kbtest"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/keybase/client/go/protocol/keybase1"
	"github.com/stretchr/testify/require"
)

// archiveInboxSource stands in for an inbox read that is still finishing when
// the job is cancelled: it holds the read until the job's output path is gone
// (or a deadline passes), then answers with one conversation anyway.
type archiveInboxSource struct {
	types.InboxSource
	outputPath string
	conv       chat1.ConversationLocal
	entered    chan struct{}
}

func (s *archiveInboxSource) Read(ctx context.Context, _ gregor1.UID, _ types.ConversationLocalizerTyp,
	_ types.InboxSourceDataSourceTyp, _ *int, _ *chat1.GetInboxLocalQuery,
) (types.Inbox, chan types.AsyncInboxResult, error) {
	close(s.entered)
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(s.outputPath); os.IsNotExist(err) {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	return types.Inbox{Convs: []chat1.ConversationLocal{s.conv}}, nil, nil
}

type cancelledConvSource struct {
	types.ConversationSource
}

func (s cancelledConvSource) Pull(ctx context.Context, _ chat1.ConversationID, _ gregor1.UID,
	_ chat1.GetThreadReason, _ func() chat1.RemoteInterface, _ *chat1.GetThreadQuery,
	_ *chat1.Pagination,
) (chat1.ThreadView, error) {
	if err := ctx.Err(); err != nil {
		return chat1.ThreadView{}, err
	}
	return chat1.ThreadView{}, errors.New("unexpected pull on a live job")
}

func newTestArchiveRegistry(t *testing.T, name string, inbox types.InboxSource) (
	*globals.Context, *ChatArchiveRegistry, gregor1.UID,
) {
	tc := libkb.SetupTest(t, name, 0)
	t.Cleanup(tc.Cleanup)
	tc.G.UIRouter = kbtest.NewMockUIRouter(kbtest.NewChatUI())
	g := globals.NewContext(tc.G, &globals.ChatContext{})
	g.InboxSource = inbox
	g.ConvSource = cancelledConvSource{}
	g.EmojiSource = types.DummyEmojiSource{}

	uid := gregor1.UID([]byte("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
	registry := NewChatArchiveRegistry(g, nil)
	// Skip Start: its encrypted job history needs a logged-in user.
	registry.started = true
	registry.inited = true
	registry.uid = uid
	g.ArchiveRegistry = registry
	return g, registry, uid
}

func requireJobNotFound(ctx context.Context, t *testing.T,
	registry *ChatArchiveRegistry, jobID chat1.ArchiveJobID,
) {
	job, err := registry.Get(ctx, jobID)
	require.ErrorAs(t, err, new(ArchiveJobNotFoundError),
		"deleted job is back in the registry with status %v", job.Status)
}

// Deleting a running job with deleteOutputPath must leave nothing on disk,
// even when the job is still unwinding after it has been cancelled.
func TestArchiveRegistryDeleteRemovesOutputOfUnwindingJob(t *testing.T) {
	outputPath := filepath.Join(t.TempDir(), "kbchat-out")
	src := &archiveInboxSource{
		outputPath: outputPath,
		entered:    make(chan struct{}),
		conv: chat1.ConversationLocal{
			Info: chat1.ConversationInfoLocal{
				Id:           chat1.ConversationID([]byte("cccccccccccccccccccccccccccccccc")),
				TlfName:      "testuser,testuser2",
				MembersType:  chat1.ConversationMembersType_IMPTEAMNATIVE,
				Visibility:   keybase1.TLFVisibility_PRIVATE,
				Participants: []chat1.ConversationLocalParticipant{{Username: "testuser"}, {Username: "testuser2"}},
			},
		},
	}
	g, registry, uid := newTestArchiveRegistry(t, "TestArchiveRegistryDeleteRemovesOutputOfUnwindingJob", src)

	ctx := context.TODO()
	jobID := chat1.ArchiveJobID("testjob")
	jobDone := make(chan struct{})
	go func() {
		defer close(jobDone)
		_, _ = NewChatArchiver(g, uid, nil).ArchiveChat(ctx, chat1.ArchiveChatJobRequest{
			JobID:      jobID,
			OutputPath: outputPath,
		})
	}()

	select {
	case <-src.entered:
	case <-time.After(10 * time.Second):
		require.Fail(t, "archive job never reached the inbox read")
	}
	_, err := os.Stat(outputPath)
	require.NoError(t, err, "job should have created its output path")

	deleteDone := make(chan error, 1)
	go func() { deleteDone <- registry.Delete(ctx, jobID, true) }()
	select {
	case err := <-deleteDone:
		require.NoError(t, err)
	case <-time.After(10 * time.Second):
		require.Fail(t, "Delete never returned")
	}
	select {
	case <-jobDone:
	case <-time.After(10 * time.Second):
		require.Fail(t, "archive job never finished")
	}

	requireJobNotFound(ctx, t, registry, jobID)
	require.Eventually(t, func() bool {
		_, err := os.Stat(outputPath)
		return os.IsNotExist(err)
	}, 3*time.Second, 10*time.Millisecond,
		"cancelled job wrote into %s after Delete removed it", outputPath)
}

type emptyInboxSource struct {
	types.InboxSource
}

func (emptyInboxSource) Read(context.Context, gregor1.UID, types.ConversationLocalizerTyp,
	types.InboxSourceDataSourceTyp, *int, *chat1.GetInboxLocalQuery,
) (types.Inbox, chan types.AsyncInboxResult, error) {
	return types.Inbox{}, nil, nil
}

// A compressed job's output is the tarball next to OutputPath, so deleting
// the finished job with deleteOutputPath must remove that tarball.
func TestArchiveRegistryDeleteRemovesCompressedOutput(t *testing.T) {
	g, registry, uid := newTestArchiveRegistry(t, "TestArchiveRegistryDeleteRemovesCompressedOutput", emptyInboxSource{})

	ctx := context.TODO()
	jobID := chat1.ArchiveJobID("testjob")
	outputPath := filepath.Join(t.TempDir(), "kbchat-out")
	tarball, err := NewChatArchiver(g, uid, nil).ArchiveChat(ctx, chat1.ArchiveChatJobRequest{
		JobID:      jobID,
		OutputPath: outputPath,
		Compress:   true,
	})
	require.NoError(t, err)
	_, err = os.Stat(tarball)
	require.NoError(t, err, "compressed job should have written %s", tarball)
	job, err := registry.Get(ctx, jobID)
	require.NoError(t, err)
	require.Equal(t, chat1.ArchiveChatJobStatus_COMPLETE, job.Status)

	require.NoError(t, registry.Delete(ctx, jobID, true))
	requireJobNotFound(ctx, t, registry, jobID)
	require.Eventually(t, func() bool {
		_, err := os.Stat(tarball)
		return os.IsNotExist(err)
	}, 3*time.Second, 10*time.Millisecond,
		"Delete left the compressed output %s behind", tarball)
}
