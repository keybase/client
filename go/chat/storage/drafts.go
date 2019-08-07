package storage

import (
	"fmt"

	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/net/context"
)

type Draft struct {
	ConvID chat1.ConversationID `codec:"c"`
	Text   string               `codec:"t"`
}

type diskDrafts struct {
	Drafts map[string]Draft `codec:"d"`
}

type Drafts struct {
	globals.Contextified
	utils.DebugLabeler
	*baseBox

	uid gregor1.UID
}

func NewDrafts(g *globals.Context, uid gregor1.UID) *Drafts {
	return &Drafts{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.GetLog(), "Drafts", false),
		baseBox:      newBaseBox(g),
		uid:          uid,
	}
}

func (d *Drafts) dbKey() libkb.DbKey {
	return libkb.DbKey{
		Typ: libkb.DBChatDrafts,
		Key: fmt.Sprintf("drafts:%s", d.uid),
	}
}

func (d *Drafts) Put(ctx context.Context, convID chat1.ConversationID, text string) Error {
	locks.Drafts.Lock()
	defer locks.Drafts.Unlock()
	var dd diskDrafts
	found, ierr := d.readDiskBox(ctx, d.dbKey(), &dd)
	if ierr != nil {
		return NewInternalError(ctx, d.DebugLabeler, "failed to read drafts: %s", ierr)
	}
	if !found {
		dd.Drafts = make(map[string]Draft)
	}
	dd.Drafts[convID.String()] = Draft{
		ConvID: convID,
		Text:   text,
	}
	if err := d.writeDiskBox(ctx, d.dbKey(), dd); err != nil {
		return NewInternalError(ctx, d.DebugLabeler, "error writing drafts: %s", err)
	}
	return nil
}

func (d *Drafts) Get(ctx context.Context) (res map[string]Draft, err Error) {
	locks.Drafts.Lock()
	defer locks.Drafts.Unlock()
	var dd diskDrafts
	found, ierr := d.readDiskBox(ctx, d.dbKey(), &dd)
	if ierr != nil {
		return res, NewInternalError(ctx, d.DebugLabeler, "failed to read drafts: %s", err)
	}
	if !found {
		return make(map[string]Draft), nil
	}
	return dd.Drafts, nil
}

func (d *Drafts) Clear(ctx context.Context, convID chat1.ConversationID) Error {
	locks.Drafts.Lock()
	defer locks.Drafts.Unlock()
	var dd diskDrafts
	found, ierr := d.readDiskBox(ctx, d.dbKey(), &dd)
	if ierr != nil {
		return NewInternalError(ctx, d.DebugLabeler, "failed to read drafts: %s", ierr)
	}
	if !found {
		return nil
	}
	delete(dd.Drafts, convID.String())
	if err := d.writeDiskBox(ctx, d.dbKey(), dd); err != nil {
		return NewInternalError(ctx, d.DebugLabeler, "error writing drafts: %s", err)
	}
	return nil
}
