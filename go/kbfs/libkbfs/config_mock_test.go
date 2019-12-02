// Copyright 2016 Keybase Inc. All rights reserved.
// Use of this source code is governed by a BSD
// license that can be found in the LICENSE file.

package libkbfs

import (
	"github.com/golang/mock/gomock"
	"github.com/keybase/client/go/kbfs/data"
	"github.com/keybase/client/go/kbfs/kbfscodec"
	"github.com/keybase/client/go/kbfs/kbfsedits"
	"github.com/keybase/client/go/kbfs/tlfhandle"
	"github.com/keybase/client/go/logger"
	"github.com/keybase/client/go/protocol/keybase1"
	"golang.org/x/net/context"
)

type FakeObserver struct {
	localChange  Node
	batchChanges []NodeChange
	ctx          context.Context
}

func (fn *FakeObserver) LocalChange(ctx context.Context,
	node Node, write WriteRange) {
	fn.localChange = node
	fn.ctx = ctx
}

func (fn *FakeObserver) BatchChanges(
	ctx context.Context, nodeChanges []NodeChange, _ []NodeID) {
	fn.batchChanges = nodeChanges
	fn.ctx = ctx
}

func (fn *FakeObserver) TlfHandleChange(ctx context.Context,
	newHandle *tlfhandle.Handle) {
}

type ConfigMock struct {
	ConfigLocal

	// local references to the proper mock type
	mockKbfs                         *MockKBFSOps
	mockKbpki                        *MockKBPKI
	mockKbs                          *MockKeybaseService
	mockKeyman                       *MockKeyManager
	mockRep                          *MockReporter
	mockMdcache                      *MockMDCache
	mockKcache                       *MockKeyCache
	mockBcache                       *MockBlockCache
	mockDirtyBcache                  *MockDirtyBlockCache
	mockCrypto                       *MockCrypto
	mockChat                         *MockChat
	mockCodec                        *kbfscodec.MockCodec
	mockMdops                        *MockMDOps
	mockKops                         *MockKeyOps
	mockBops                         *MockBlockOps
	mockMdserv                       *MockMDServer
	mockKserv                        *MockKeyServer
	mockBserv                        *MockBlockServer
	mockBsplit                       *MockBlockSplitter
	mockNotifier                     *MockNotifier
	mockClock                        *MockClock
	mockRekeyQueue                   *MockRekeyQueue
	mockSubscriptionManagerPublisher *MockSubscriptionManagerPublisher
	observer                         *FakeObserver
	ctr                              *SafeTestReporter
}

func NewConfigMock(c *gomock.Controller, ctr *SafeTestReporter) *ConfigMock {
	config := &ConfigMock{
		ConfigLocal: ConfigLocal{
			loggerFn: func(m string) logger.Logger {
				return logger.NewTestLogger(ctr.t)
			},
		},
	}
	config.mockKbfs = NewMockKBFSOps(c)
	config.SetKBFSOps(config.mockKbfs)
	config.mockKbs = NewMockKeybaseService(c)
	config.SetKeybaseService(config.mockKbs)
	config.mockKbpki = NewMockKBPKI(c)
	config.SetKBPKI(config.mockKbpki)
	config.mockKeyman = NewMockKeyManager(c)
	config.SetKeyManager(config.mockKeyman)
	config.mockRep = NewMockReporter(c)
	config.SetReporter(config.mockRep)
	config.mockMdcache = NewMockMDCache(c)
	config.SetMDCache(config.mockMdcache)
	config.mockKcache = NewMockKeyCache(c)
	config.SetKeyCache(config.mockKcache)
	config.mockBcache = NewMockBlockCache(c)
	config.SetBlockCache(config.mockBcache)
	config.mockDirtyBcache = NewMockDirtyBlockCache(c)
	config.SetDirtyBlockCache(config.mockDirtyBcache)
	config.mockCrypto = NewMockCrypto(c)
	config.SetCrypto(config.mockCrypto)
	config.mockChat = NewMockChat(c)
	config.SetChat(config.mockChat)
	config.mockCodec = kbfscodec.NewMockCodec(c)
	config.mockCodec.EXPECT().RegisterType(gomock.Any(), gomock.Any()).
		AnyTimes().Return()
	config.mockCodec.EXPECT().RegisterIfaceSliceType(gomock.Any(),
		gomock.Any(), gomock.Any()).AnyTimes().Return()
	config.SetCodec(config.mockCodec)
	config.mockMdops = NewMockMDOps(c)
	config.SetMDOps(config.mockMdops)
	config.mockKops = NewMockKeyOps(c)
	config.SetKeyOps(config.mockKops)
	config.mockBops = NewMockBlockOps(c)
	config.SetBlockOps(config.mockBops)
	config.mockMdserv = NewMockMDServer(c)
	// Ignore all reconnect backoff fast forwards
	config.mockMdserv.EXPECT().FastForwardBackoff().AnyTimes()
	config.SetMDServer(config.mockMdserv)
	config.mockKserv = NewMockKeyServer(c)
	config.SetKeyServer(config.mockKserv)
	config.mockBserv = NewMockBlockServer(c)
	config.SetBlockServer(config.mockBserv)
	config.mockBsplit = NewMockBlockSplitter(c)
	config.SetBlockSplitter(config.mockBsplit)
	config.mockNotifier = NewMockNotifier(c)
	config.SetNotifier(config.mockNotifier)
	config.mockClock = NewMockClock(c)
	config.SetClock(config.mockClock)
	config.mockRekeyQueue = NewMockRekeyQueue(c)
	config.SetRekeyQueue(config.mockRekeyQueue)
	uhLog := config.MakeLogger("HIS")
	config.SetUserHistory(kbfsedits.NewUserHistory(
		uhLog, config.MakeVLogger(uhLog)))
	config.observer = &FakeObserver{}
	config.ctr = ctr
	// turn off background flushing by default during tests
	config.noBGFlush = true

	config.maxNameBytes = data.MaxNameBytesDefault
	config.rwpWaitTime = rekeyWithPromptWaitTimeDefault

	config.SetMetadataVersion(defaultClientMetadataVer)
	config.mode = modeTest{NewInitModeFromType(InitDefault)}
	config.conflictResolutionDB = openCRDB(config)

	config.mockSubscriptionManagerPublisher = NewMockSubscriptionManagerPublisher(gomock.NewController(ctr.t))
	config.subscriptionManagerPublisher = config.mockSubscriptionManagerPublisher
	config.mockSubscriptionManagerPublisher.EXPECT().PublishChange(
		keybase1.SubscriptionTopic_FAVORITES).AnyTimes()
	config.mockSubscriptionManagerPublisher.EXPECT().PublishChange(
		keybase1.SubscriptionTopic_JOURNAL_STATUS).AnyTimes()
	config.mockSubscriptionManagerPublisher.EXPECT().PublishChange(
		keybase1.SubscriptionTopic_FILES_TAB_BADGE).AnyTimes()

	return config
}

// CheckStateOnShutdown implements the Config interface for ConfigLocal.
func (c *ConfigMock) CheckStateOnShutdown() bool {
	return false
}
