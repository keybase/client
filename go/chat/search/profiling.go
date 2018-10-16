package search

import (
	"context"
	"time"

	"github.com/keybase/client/go/chat/storage"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
)

const defaultPageSize = 300

func (idx *Indexer) IndexInbox(ctx context.Context, uid gregor1.UID) (res map[string]chat1.IndexSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.IndexInbox")()

	ib := storage.NewInbox(idx.G())
	_, convs, err := ib.ReadAll(ctx, uid)
	if err != nil {
		return nil, err
	}

	res = map[string]chat1.IndexSearchConvStats{}
	for _, conv := range convs {
		convID := conv.GetConvID()
		idx.G().Log.CDebugf(ctx, "Indexing conv: %v", conv.GetName())
		convStats, err := idx.indexConv(ctx, uid, convID)
		if err != nil {
			idx.G().Log.CDebugf(ctx, "Indexing errored for conv: %v, %v", conv.GetName(), err)
			continue
		}
		idx.G().Log.CDebugf(ctx, "Indexing completed for conv: %v, stats: %+v", conv.GetName(), convStats)
		res[convID.String()] = convStats
	}
	return res, nil
}

func (idx *Indexer) IndexConv(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res chat1.IndexSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.IndexConv")()
	return idx.indexConv(ctx, uid, convID)
}

func (idx *Indexer) indexConv(ctx context.Context, uid gregor1.UID, convID chat1.ConversationID) (res chat1.IndexSearchConvStats, err error) {
	defer idx.Trace(ctx, func() error { return err }, "Indexer.indexConv")()

	startT := time.Now()
	pagination := &chat1.Pagination{Num: defaultPageSize}
	for !pagination.Last {
		thread, err := idx.G().ConvSource.Pull(ctx, convID, uid,
			chat1.GetThreadReason_INDEXED_SEARCH,
			nil, pagination)
		if err != nil {
			return res, err
		}
		pagination = thread.Pagination
		pagination.Num = defaultPageSize
		pagination.Previous = nil

		res.NumMessages += len(thread.Messages)
		if err = idx.Add(ctx, convID, uid, thread.Messages); err != nil {
			return res, err
		}
	}
	res.DurationMsec = gregor1.ToDurationMsec(time.Now().Sub(startT))
	dbKey := idx.store.dbKey(convID, uid)
	b, _, err := idx.G().LocalChatDb.GetRaw(dbKey)
	if err != nil {
		return res, err
	}
	res.IndexSize = len(b)
	return res, nil
}
