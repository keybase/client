package chat

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"sync"
	"time"

	"github.com/keybase/client/go/chat/attachments"
	"github.com/keybase/client/go/chat/globals"
	"github.com/keybase/client/go/chat/types"
	"github.com/keybase/client/go/chat/utils"
	"github.com/keybase/client/go/chatrender"
	"github.com/keybase/client/go/libkb"
	"github.com/keybase/client/go/protocol/chat1"
	"github.com/keybase/client/go/protocol/gregor1"
	"golang.org/x/sync/errgroup"
)

type ChatArchiveRegistry struct {
	globals.Contextified
	utils.DebugLabeler
	sync.Mutex

	stopCh       chan struct{}
	started      bool
	uid          gregor1.UID
	remoteClient func() chat1.RemoteInterface
	runningJobs  map[chat1.ArchiveJobID]types.CancelArchiveFn

	// TODO put into DB
	mdb        *libkb.JSONLocalDb
	jobHistory map[chat1.ArchiveJobID]chat1.ArchiveChatJob
}

type ArchiveJobNotFoundError struct {
	jobID chat1.ArchiveJobID
}

func (e ArchiveJobNotFoundError) Error() string {
	return fmt.Sprintf("job not found: %s", e.jobID)
}

func NewArchiveJobNotFoundError(jobID chat1.ArchiveJobID) ArchiveJobNotFoundError {
	return ArchiveJobNotFoundError{jobID: jobID}
}

var _ error = ArchiveJobNotFoundError{}

func NewChatArchiveRegistry(g *globals.Context, remoteClient func() chat1.RemoteInterface) *ChatArchiveRegistry {
	return &ChatArchiveRegistry{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "ChatArchiveRegistry", false),
		remoteClient: remoteClient,
		runningJobs:  make(map[chat1.ArchiveJobID]types.CancelArchiveFn),
		jobHistory:   make(map[chat1.ArchiveJobID]chat1.ArchiveChatJob),
	}
}

func (r *ChatArchiveRegistry) Start(ctx context.Context, uid gregor1.UID) {
	defer r.Trace(ctx, nil, "Start")()
	r.Lock()
	defer r.Unlock()
	if r.started {
		return
	}
	r.uid = uid
	r.started = true
	r.stopCh = make(chan struct{})
	// TODO create DB, flush loop
	// TODO with a little delay restart the jobs
}

func (r *ChatArchiveRegistry) Stop(ctx context.Context) chan struct{} {
	defer r.Trace(ctx, nil, "Stop")()
	r.Lock()
	defer r.Unlock()
	ch := make(chan struct{})
	if r.started {
		r.started = false
		close(r.stopCh)
		go func() {
			r.Debug(context.Background(), "Stop: waiting for shutdown, %d jobs", len(r.runningJobs))
			for jobID, cancel := range r.runningJobs {
				job := cancel()
				job.Status = chat1.ArchiveChatJobStatus_PAUSED
				r.jobHistory[jobID] = job
			}
			// TODO wait for bg flush
			r.Debug(context.Background(), "Stop: shutdown complete")
			close(ch)
		}()
	} else {
		close(ch)
	}
	return ch

}

func (r *ChatArchiveRegistry) List(ctx context.Context) (res chat1.ArchiveChatListRes, err error) {
	defer r.Trace(ctx, &err, "List")()
	r.Lock()
	defer r.Unlock()
	if !r.started {
		return res, errors.New("not started")
	}

	for _, job := range r.jobHistory {
		res.Jobs = append(res.Jobs, job)
	}
	return res, nil
}

func (r *ChatArchiveRegistry) Get(ctx context.Context, jobID chat1.ArchiveJobID) (res chat1.ArchiveChatJob, err error) {
	defer r.Trace(ctx, &err, "Get(%s)", jobID)()
	r.Lock()
	defer r.Unlock()
	if !r.started {
		return res, errors.New("not started")
	}

	job, ok := r.jobHistory[jobID]
	if !ok {
		return res, NewArchiveJobNotFoundError(jobID)
	}
	return job, nil
}

func (r *ChatArchiveRegistry) Delete(ctx context.Context, jobID chat1.ArchiveJobID) (err error) {
	defer r.Trace(ctx, &err, "Delete(%s)", jobID)()
	r.Lock()
	defer r.Unlock()
	if !r.started {
		return errors.New("not started")
	}

	cancel, ok := r.runningJobs[jobID]
	if ok {
		// Ignore the job output since we're deleting it anyway
		cancel()
		delete(r.runningJobs, jobID)
	}

	if _, ok := r.jobHistory[jobID]; !ok {
		return NewArchiveJobNotFoundError(jobID)
	}
	delete(r.jobHistory, jobID)
	return nil
}

func (r *ChatArchiveRegistry) Set(ctx context.Context, cancel types.CancelArchiveFn, job chat1.ArchiveChatJob) (err error) {
	defer r.Trace(ctx, &err, "Set(%+v)", job)()
	r.Lock()
	defer r.Unlock()
	if !r.started {
		return errors.New("not started")
	}

	jobID := job.Request.JobID
	if cancel != nil {
		r.runningJobs[jobID] = cancel
	} else {
		delete(r.runningJobs, jobID)
	}

	r.jobHistory[jobID] = job
	return nil
}

func (r *ChatArchiveRegistry) Pause(ctx context.Context, jobID chat1.ArchiveJobID) (err error) {
	defer r.Trace(ctx, &err, "Pause(%v)", jobID)()
	r.Lock()
	defer r.Unlock()

	if !r.started {
		return errors.New("not started")
	}

	job, ok := r.jobHistory[jobID]
	if !ok {
		return NewArchiveJobNotFoundError(jobID)
	}

	if job.Status != chat1.ArchiveChatJobStatus_RUNNING {
		return fmt.Errorf("Cannot pause a non-running job. Found status %v", job.Status)
	}

	cancel, ok := r.runningJobs[jobID]
	if !ok {
		return NewArchiveJobNotFoundError(jobID)
	}
	job = cancel()
	job.Status = chat1.ArchiveChatJobStatus_PAUSED
	r.jobHistory[jobID] = job
	return nil
}

func (r *ChatArchiveRegistry) Resume(ctx context.Context, jobID chat1.ArchiveJobID) (err error) {
	defer r.Trace(ctx, &err, "Resume(%v)", jobID)()
	r.Lock()
	defer r.Unlock()

	if !r.started {
		return errors.New("not started")
	}

	job, ok := r.jobHistory[jobID]
	if !ok {
		return NewArchiveJobNotFoundError(jobID)
	}

	if job.Status != chat1.ArchiveChatJobStatus_PAUSED {
		return fmt.Errorf("Cannot resume a non-paused job. Found status %v", job.Status)
	}

	// Resume the job in the background, the job will register itself as running
	go func() {
		_, err := NewChatArchiver(r.G(), r.uid, r.remoteClient).ArchiveChat(context.Background(), job.Request)
		if err != nil {
			r.Debug(ctx, err.Error())
		}
	}()
	return nil
}

var _ types.ChatArchiveRegistry = (*ChatArchiveRegistry)(nil)

const defaultPageSize = 1000

// Fullfil an archive query
type ChatArchiver struct {
	globals.Contextified
	utils.DebugLabeler
	uid gregor1.UID

	sync.Mutex
	messagesComplete int64
	messagesTotal    int64
	remoteClient     func() chat1.RemoteInterface
}

func NewChatArchiver(g *globals.Context, uid gregor1.UID, remoteClient func() chat1.RemoteInterface) *ChatArchiver {
	return &ChatArchiver{
		Contextified: globals.NewContextified(g),
		DebugLabeler: utils.NewDebugLabeler(g.ExternalG(), "ChatArchiver", false),
		uid:          uid,
		remoteClient: remoteClient,
	}
}

func (c *ChatArchiver) notifyProgress(ctx context.Context, jobID chat1.ArchiveJobID, messagesCompleted int64) {
	c.Lock()
	defer c.Unlock()
	c.messagesComplete += messagesCompleted
	if c.messagesComplete > c.messagesTotal {
		// total messages is capped to the convs expunge, don't over report.
		c.messagesComplete = c.messagesTotal
	}
	c.G().NotifyRouter.HandleChatArchiveProgress(ctx, jobID, c.messagesComplete, c.messagesTotal)
}

func (c *ChatArchiver) archiveName(conv chat1.ConversationLocal) string {
	return chatrender.ConvName(c.G().GlobalContext, conv, c.G().GlobalContext.Env.GetUsername().String())
}

func (c *ChatArchiver) attachmentName(msg chat1.MessageUnboxedValid) string {
	body := msg.MessageBody
	typ, err := body.MessageType()
	if err != nil {
		return ""
	}
	if typ == chat1.MessageType_ATTACHMENT {
		att := body.Attachment()
		return fmt.Sprintf("%s (%d) - %s", gregor1.FromTime(msg.ServerHeader.Ctime).Format("2006-01-02 15.04.05"), msg.ServerHeader.MessageID, att.Object.Filename)
	}
	return ""
}

func (c *ChatArchiver) archiveConv(ctx context.Context, job *chat1.ArchiveChatJob, conv chat1.ConversationLocal) error {
	var f *os.File
	var cp chat1.ArchiveChatConvCheckpoint
	{
		c.Lock()
		var ok bool
		cp, ok = job.Checkpoints[conv.Info.Id.DbShortFormString()]
		if !ok {
			cp = chat1.ArchiveChatConvCheckpoint{
				Pagination: chat1.Pagination{Num: defaultPageSize},
				Offset:     0,
			}
		}
		c.Unlock()
	}
	// Update our checkpoint with our committed state
	convArchivePath := path.Join(job.Request.OutputPath, c.archiveName(conv), "chat.txt")
	f, err := os.OpenFile(convArchivePath, os.O_RDWR|os.O_CREATE, libkb.PermFile)
	if err != nil {
		return err
	}
	err = f.Truncate(cp.Offset)
	if err != nil {
		return err
	}
	_, err = f.Seek(cp.Offset, 0)
	if err != nil {
		return err
	}
	defer f.Close()

	firstPage := true
	for !cp.Pagination.Last {
		thread, err := c.G().ConvSource.Pull(ctx, conv.Info.Id, c.uid,
			chat1.GetThreadReason_ARCHIVE, nil,
			&chat1.GetThreadQuery{
				MarkAsRead: false,
			}, &cp.Pagination)
		if err != nil {
			return err
		}

		msgs := thread.Messages

		// reverse the thread in place so we render in descending order in the file.
		for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
			msgs[i], msgs[j] = msgs[j], msgs[i]
		}

		view := chatrender.ConversationView{
			Conversation: conv,
			Messages:     msgs,
			Opts: chatrender.RenderOptions{
				UseDateTime: true,
				// Only show the headline message once
				SkipHeadline: !firstPage,
			},
		}

		err = view.RenderToWriter(c.G().GlobalContext, f, 1024, false)
		if err != nil {
			return err
		}

		// Check for any attachment messages and download them alongside the chat.
		var eg errgroup.Group
		// Fetch attachments in parallel but limit the number since we
		// also allow parallel conv fetching.
		eg.SetLimit(5)
		for _, m := range msgs {
			if !m.IsValidFull() {
				continue
			}
			msg := m.Valid()
			body := msg.MessageBody
			typ, err := body.MessageType()
			if err != nil {
				return err
			}
			if typ == chat1.MessageType_ATTACHMENT {
				eg.Go(func() error {
					attachmentPath := path.Join(job.Request.OutputPath, c.archiveName(conv), c.attachmentName(msg))
					f, err := os.Create(attachmentPath)
					if err != nil {
						return err
					}
					defer f.Close()

					err = attachments.Download(ctx, c.G(), c.uid, conv.Info.Id,
						msg.ServerHeader.MessageID, f, false, func(_, _ int64) {}, c.remoteClient)
					if err != nil {
						return err
					}
					return nil
				})
			}
		}
		err = eg.Wait()
		if err != nil {
			return err
		}

		c.notifyProgress(ctx, job.Request.JobID, int64(thread.Pagination.Num))

		// update our global pagination so we can correctly fetch the next page.
		firstPage = false
		cp.Pagination = *thread.Pagination
		cp.Pagination.Num = defaultPageSize
		cp.Pagination.Previous = nil

		// Checkpoint our progress
		err = f.Sync()
		if err != nil {
			return err
		}
		stat, err := f.Stat()
		if err != nil {
			return err
		}
		cp.Offset = stat.Size()
		{
			c.Lock()
			job.Checkpoints[conv.Info.Id.DbShortFormString()] = cp
			c.Unlock()
		}
	}
	return nil
}

func (c *ChatArchiver) ArchiveChat(ctx context.Context, arg chat1.ArchiveChatJobRequest) (outpath string, err error) {
	defer c.Trace(ctx, &err, "ArchiveChat")()

	if len(arg.OutputPath) == 0 {
		arg.OutputPath = path.Join(c.G().GlobalContext.Env.GetDownloadsDir(), string(arg.JobID))
	}

	// Make sure the root output path exists
	err = os.MkdirAll(arg.OutputPath, os.ModePerm)
	if err != nil {
		return "", err
	}

	// Resolve query to a set of convIDs.
	iboxRes, _, err := c.G().InboxSource.Read(ctx, c.uid, types.ConversationLocalizerBlocking,
		types.InboxSourceDataSourceAll, nil, arg.Query)
	if err != nil {
		return "", err
	}
	convs := iboxRes.Convs

	// Fetch size of each conv to track progress.
	for _, conv := range convs {
		c.messagesTotal += int64(conv.MaxVisibleMsgID() - conv.GetMaxDeletedUpTo())

		convArchivePath := path.Join(arg.OutputPath, c.archiveName(conv))
		err = os.MkdirAll(convArchivePath, os.ModePerm)
		if err != nil {
			return "", err
		}
	}

	jobInfo, err := c.G().ArchiveRegistry.Get(ctx, arg.JobID)
	if err != nil {
		if _, ok := err.(ArchiveJobNotFoundError); !ok {
			return "", err
		}
		jobInfo = chat1.ArchiveChatJob{
			Request:     arg,
			StartedAt:   gregor1.ToTime(time.Now()),
			Status:      chat1.ArchiveChatJobStatus_RUNNING,
			Err:         "",
			Checkpoints: make(map[string]chat1.ArchiveChatConvCheckpoint),
		}
	}
	jobInfo.Status = chat1.ArchiveChatJobStatus_RUNNING

	eg, ctx := errgroup.WithContext(ctx)
	ctx, cancel := context.WithCancel(ctx)
	cancelCh := make(chan struct{})
	doneCh := make(chan struct{})
	pause := func() chat1.ArchiveChatJob {
		cancel()
		close(cancelCh)
		// Block until we cleanup
		<-doneCh
		c.Lock()
		defer c.Unlock()
		return jobInfo
	}

	err = c.G().ArchiveRegistry.Set(ctx, pause, jobInfo)
	if err != nil {
		return "", err
	}
	defer func() {
		defer func() { close(doneCh) }()
		select {
		case <-cancelCh:
			c.Debug(ctx, "canceled by registry, short-circuiting.")
			// If we were canceled by the registry, abort.
			return
		default:
			c.Debug(ctx, "marking task complete %v", err)
		}
		status := chat1.ArchiveChatJobStatus_COMPLETE
		if err != nil {
			status = chat1.ArchiveChatJobStatus_ERROR
			jobInfo.Err = err.Error()
		}
		jobInfo.Status = status
		ierr := c.G().ArchiveRegistry.Set(ctx, nil, jobInfo)
		if ierr != nil {
			c.Debug(ctx, ierr.Error())
		}
		c.G().NotifyRouter.HandleChatArchiveComplete(ctx, arg.JobID)
	}()

	// For each conv, fetch batches of messages until all are fetched.
	//    - Messages are rendered in a text format and attachments are downloaded to the archive path.
	eg.SetLimit(10)
	for _, conv := range convs {
		conv := conv
		eg.Go(func() error {
			return c.archiveConv(ctx, &jobInfo, conv)
		})
	}
	err = eg.Wait()
	if err != nil {
		return "", err
	}

	outpath = arg.OutputPath
	if arg.Compress {
		outpath += ".tar.gzip"
		err = tarGzip(arg.OutputPath, outpath)
		if err != nil {
			return "", err
		}
		err = os.RemoveAll(arg.OutputPath)
		if err != nil {
			return "", err
		}
	}

	return outpath, nil
}

func tarGzip(inPath, outPath string) error {
	f, err := os.Create(outPath)
	if err != nil {
		return err
	}
	defer f.Close()

	zr := gzip.NewWriter(f)
	defer zr.Close()
	tw := tar.NewWriter(zr)
	defer tw.Close()

	err = filepath.Walk(inPath, func(fp string, fi os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		header, err := tar.FileInfoHeader(fi, fp)
		if err != nil {
			return err
		}
		name, err := filepath.Rel(inPath, filepath.ToSlash(fp))
		if err != nil {
			return err
		}
		header.Name = name

		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		if fi.IsDir() {
			return nil
		}
		file, err := os.Open(fp)
		if err != nil {
			return err
		}
		defer file.Close()
		if _, err := io.Copy(tw, file); err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return err
	}
	return nil
}
