package chat

import (
	"context"
	"testing"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"github.com/stretchr/testify/require"
)

// patchPaginationConv is the smallest thing satisfying types.UnboxConversationInfo. Only
// GetExpunge is consulted by patchPaginationLast; the rest exist to satisfy the interface.
type patchPaginationConv struct {
	expunge *chat1.Expunge
}

var _ types.UnboxConversationInfo = patchPaginationConv{}

func (c patchPaginationConv) GetConvID() chat1.ConversationID { return nil }
func (c patchPaginationConv) GetMembersType() chat1.ConversationMembersType {
	return chat1.ConversationMembersType_TEAM
}
func (c patchPaginationConv) GetFinalizeInfo() *chat1.ConversationFinalizeInfo { return nil }
func (c patchPaginationConv) GetExpunge() *chat1.Expunge                       { return c.expunge }
func (c patchPaginationConv) GetMaxDeletedUpTo() chat1.MessageID               { return 0 }
func (c patchPaginationConv) IsPublic() bool                                   { return false }
func (c patchPaginationConv) GetMaxMessage(chat1.MessageType) (chat1.MessageSummary, error) {
	return chat1.MessageSummary{}, nil
}

// newPatchPaginationSource builds just enough of a baseConversationSource to call
// patchPaginationLast. It needs no database, network or logged in user - a bare GlobalContext
// already carries a logger, which is all Debug touches.
func newPatchPaginationSource() *baseConversationSource {
	g := libkb.NewGlobalContext()
	return &baseConversationSource{
		Contextified: globals.NewContextified(globals.NewContext(g, &globals.ChatContext{})),
		DebugLabeler: utils.NewDebugLabeler(g, "patchPaginationTest", false),
	}
}

func msgsWithIDs(ids ...chat1.MessageID) []chat1.MessageUnboxed {
	res := make([]chat1.MessageUnboxed, 0, len(ids))
	for _, id := range ids {
		res = append(res, chat1.NewMessageUnboxedWithPlaceholder(chat1.MessageUnboxedPlaceholder{
			MessageID: id,
		}))
	}
	return res
}

func TestPatchPaginationLast(t *testing.T) {
	ctx := context.Background()
	uid := gregor1.UID([]byte{0x01})
	s := newPatchPaginationSource()

	testCases := []struct {
		name    string
		expunge *chat1.Expunge
		msgs    []chat1.MessageUnboxed
		page    *chat1.Pagination
		want    bool
	}{
		{
			name: "an empty page is the last page",
			msgs: nil,
			page: &chat1.Pagination{Num: 50},
			want: true,
		},
		{
			// The regression this guards: after a nuke a conversation whose history was deleted
			// reads back Upto:0 until its inbox entry is localized, so the expunge check below
			// never fires and Last stays false forever - "Digging ancient messages..." on a fully
			// loaded thread.
			name:    "reaching message ID 1 is last even when expunge reads back Upto:0",
			expunge: &chat1.Expunge{Upto: 0},
			msgs:    msgsWithIDs(1, 2, 3),
			page:    &chat1.Pagination{Num: 50},
			want:    true,
		},
		{
			name: "reaching message ID 1 is last even with no expunge record at all",
			msgs: msgsWithIDs(1, 2, 3),
			page: &chat1.Pagination{Num: 50},
			want: true,
		},
		{
			// Pages can arrive newest first, and the check is on the oldest ID either way.
			name: "message ID 1 is found regardless of page order",
			msgs: msgsWithIDs(3, 2, 1),
			page: &chat1.Pagination{Num: 50},
			want: true,
		},
		{
			// The boundary from the other side. An over-eager check here silently truncates a
			// thread's history, which is the more damaging direction and the harder one to notice.
			name: "a page starting at message ID 2 is not last",
			msgs: msgsWithIDs(2, 3, 4),
			page: &chat1.Pagination{Num: 50},
			want: false,
		},
		{
			name: "a page above the beginning with no expunge is not last",
			msgs: msgsWithIDs(40, 41, 42),
			page: &chat1.Pagination{Num: 50},
			want: false,
		},
		{
			name:    "a page reaching the nukepoint is last",
			expunge: &chat1.Expunge{Upto: 40},
			msgs:    msgsWithIDs(40, 41, 42),
			page:    &chat1.Pagination{Num: 50},
			want:    true,
		},
		{
			name:    "a page above the nukepoint is not last",
			expunge: &chat1.Expunge{Upto: 10},
			msgs:    msgsWithIDs(40, 41, 42),
			page:    &chat1.Pagination{Num: 50},
			want:    false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			conv := patchPaginationConv{expunge: tc.expunge}
			s.patchPaginationLast(ctx, conv, uid, tc.page, tc.msgs)
			require.Equal(t, tc.want, tc.page.Last)
		})
	}
}

func TestPatchPaginationLastLeavesSettledPagesAlone(t *testing.T) {
	ctx := context.Background()
	uid := gregor1.UID([]byte{0x01})
	s := newPatchPaginationSource()
	conv := patchPaginationConv{}

	// A nil page must not panic.
	require.NotPanics(t, func() {
		s.patchPaginationLast(ctx, conv, uid, nil, msgsWithIDs(1))
	})

	// Last is only ever turned on, never off.
	page := &chat1.Pagination{Num: 50, Last: true}
	s.patchPaginationLast(ctx, conv, uid, page, msgsWithIDs(40, 41, 42))
	require.True(t, page.Last)
}
