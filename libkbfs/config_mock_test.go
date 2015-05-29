package libkbfs

import (
	"code.google.com/p/gomock/gomock"
)

type FakeObserver struct {
	localUpdatePath  Path
	batchUpdatePaths []Path
}

func (fn *FakeObserver) LocalChange(path Path) {
	fn.localUpdatePath = path
}

func (fn *FakeObserver) BatchChanges(dir DirID, paths []Path) {
	fn.batchUpdatePaths = paths
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
	config.SetCodec(config.mockCodec)
	config.mockMdops = NewMockMDOps(c)
	config.SetMDOps(config.mockMdops)
	config.mockKops = NewMockKeyOps(c)
	config.SetKeyOps(config.mockKops)
	config.mockBops = NewMockBlockOps(c)
	config.SetBlockOps(config.mockBops)
	config.mockMdserv = NewMockMDServer(c)
	config.SetMDServer(config.mockMdserv)
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
