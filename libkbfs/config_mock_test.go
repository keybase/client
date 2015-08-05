package libkbfs

import (
	"github.com/golang/mock/gomock"
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
	ctx context.Context, nodeChanges []NodeChange) {
	fn.batchChanges = nodeChanges
	fn.ctx = ctx
}

type ConfigMock struct {
	ConfigLocal

	// local references to the proper mock type
	mockKbfs     *MockKBFSOps
	mockKbpki    *MockKBPKI
	mockKeyman   *MockKeyManager
	mockRep      *MockReporter
	mockMdcache  *MockMDCache
	mockKcache   *MockKeyCache
	mockBcache   *MockBlockCache
	mockCrypto   *MockCrypto
	mockCodec    *MockCodec
	mockMdops    *MockMDOps
	mockKops     *MockKeyOps
	mockBops     *MockBlockOps
	mockMdserv   *MockMDServer
	mockKserv    *MockKeyServer
	mockBserv    *MockBlockServer
	mockBsplit   *MockBlockSplitter
	mockNotifier *MockNotifier
	observer     *FakeObserver
	ctr          *SafeTestReporter
}

func NewConfigMock(c *gomock.Controller, ctr *SafeTestReporter) *ConfigMock {
	config := &ConfigMock{}
	config.mockKbfs = NewMockKBFSOps(c)
	config.SetKBFSOps(config.mockKbfs)
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
	config.mockCrypto = NewMockCrypto(c)
	config.SetCrypto(config.mockCrypto)
	config.mockCodec = NewMockCodec(c)
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
	config.SetMDServer(config.mockMdserv)
	config.mockKserv = NewMockKeyServer(c)
	config.SetKeyServer(config.mockKserv)
	config.mockBserv = NewMockBlockServer(c)
	config.SetBlockServer(config.mockBserv)
	config.mockBsplit = NewMockBlockSplitter(c)
	config.SetBlockSplitter(config.mockBsplit)
	config.mockNotifier = NewMockNotifier(c)
	config.SetNotifier(config.mockNotifier)
	config.observer = &FakeObserver{}
	config.ctr = ctr
	return config
}
