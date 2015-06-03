//
//  KBUserProfileView.m
//  Keybase
//
//  Created by Gabriel on 1/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBUserProfileView.h"

#import "KBUserHeaderView.h"
#import "KBUserInfoView.h"
#import "AppDelegate.h"
#import "KBProofResult.h"
#import "KBFatalErrorView.h"
#import "KBTrackView.h"
#import "KBProgressOverlayView.h"
#import "KBProveView.h"
#import "KBRPClient.h"
#import "KBKeySelectView.h"
#import "KBPGPKeyGenView.h"
#import "KBProgressView.h"
#import "KBKeyView.h"
#import "KBKeyImportView.h"
#import "KBProveType.h"
#import "KBAlertView.h"

@interface KBUserProfileView ()
@property KBScrollView *scrollView;
@property KBUserHeaderView *headerView;
@property KBUserInfoView *userInfoView;
@property KBTrackView *trackView;

@property NSString *username;
@property NSMutableArray *fokids;

@property (getter=isLoading) BOOL loading;
@end

@implementation KBUserProfileView

- (void)viewInit {
  [super viewInit];
  
  _headerView = [[KBUserHeaderView alloc] init];
  _userInfoView = [[KBUserInfoView alloc] init];
  _trackView = [[KBTrackView alloc] init];
  _trackView.untrackButton.targetBlock = ^{ [self untrack]; };
  YOView *contentView = [[YOView alloc] init];
  [contentView addSubview:_headerView];
  [contentView addSubview:_userInfoView];
  [contentView addSubview:_trackView];

  YOSelf yself = self;
  contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    //CGSize headerSize = [yself.headerView sizeThatFits:CGSizeMake(MIN(400, size.width) - 20, size.height)];
    //y += [layout centerWithSize:headerSize frame:CGRectMake(0, y, MIN(400, size.width), headerSize.height) view:yself.headerView].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width - 20, 0) view:yself.headerView].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.userInfoView].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.trackView].size.height;
    return CGSizeMake(size.width, y);
  }];

  _scrollView = [[KBScrollView alloc] init];
  [_scrollView setDocumentView:contentView];
  [self addSubview:_scrollView];

  self.viewLayout = [YOLayout fill:_scrollView];
}

- (void)updateWindow {
  if (!_popup) return;

  // If we are in a popup lets adjust our window so all the content is visible
  [self layoutView];
  CGSize size = CGSizeMake(self.frame.size.width, self.frame.size.height + 40);
  // Only make it bigger (not smaller)
  if (size.height > self.window.frame.size.height) {
    CGRect frame = CGRectMake(self.window.frame.origin.x, self.window.frame.origin.y, size.width, size.height);
    [self.window setFrame:frame display:YES];
  }
}


- (void)clear {
  _username = nil;
  _fokids = nil;
  _headerView.hidden = YES;
  [_userInfoView clear];
  [_trackView clear];
  _trackView.hidden = YES;
  [self setNeedsLayout];
}

- (void)connectWithServiceName:(NSString *)serviceName proofResult:(KBProofResult *)proofResult {
  GHWeakSelf gself = self;
  [KBProveView connectWithServiceName:serviceName proofResult:proofResult client:self.client window:(KBWindow *)self.window completion:^(BOOL success) {
    [gself reload]; // Always reload even if canceled
  }];
}

- (void)openPopup:(id)sender {
  //NSAssert(self.popup, @"No configured as a popup");
  NSAssert(!self.window, @"Already in window");
  [self removeFromSuperview];
  [[sender window] kb_addChildWindowForView:self rect:CGRectMake(0, 0, 400, 400) position:KBWindowPositionCenter title:@"Keybase" fixed:NO makeKey:NO];
}

- (void)registerClient:(KBRPClient *)client sessionId:(NSInteger)sessionId sender:(id)sender {
  [self registerClient:client sessionId:sessionId approve:NO sender:sender];
}

- (void)registerClient:(KBRPClient *)client sessionId:(NSInteger)sessionId approve:(BOOL)approve sender:(id)sender {
  GHWeakSelf gself = self;
  self.client = client;

  [client registerMethod:@"keybase.1.identifyUi.start" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    [self clear];

    KBRStartRequestParams *requestParams = [[KBRStartRequestParams alloc] initWithParams:params];
    gself.username = requestParams.username;
    gself.headerView.hidden = NO;
    [gself.headerView setUsername:requestParams.username];
    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.displayKey" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRDisplayKeyRequestParams *requestParams = [[KBRDisplayKeyRequestParams alloc] initWithParams:params];
    if (!gself.fokids) gself.fokids = [NSMutableArray array];
    [gself.fokids addObject:requestParams.fokid];
    [gself.userInfoView addKey:requestParams.fokid targetBlock:^(KBRFOKID *keyId) {
      [self openKeyWithKeyId:keyId];
    }];
    [gself setNeedsLayout];
    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.launchNetworkChecks" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRLaunchNetworkChecksRequestParams *requestParams = [[KBRLaunchNetworkChecksRequestParams alloc] initWithParams:params];
    BOOL isSelf = [AppDelegate.appView.user.username isEqual:self.username];
    [gself.userInfoView addProofs:requestParams.id.proofs editable:isSelf targetBlock:^(KBProofLabel *proofLabel) {
      if (proofLabel.proofResult.result.proofResult.status != 1) {
        NSString *serviceName = proofLabel.proofResult.proof.key;
        [self connectWithServiceName:serviceName proofResult:proofLabel.proofResult];
      } else if (proofLabel.proofResult.result.hint.humanUrl) {
        [AppDelegate.sharedDelegate openURLString:proofLabel.proofResult.result.hint.humanUrl sender:self];
      }
    }];
    [gself setNeedsLayout];
    [gself updateWindow];

    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.displayCryptocurrency" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRDisplayCryptocurrencyRequestParams *requestParams = [[KBRDisplayCryptocurrencyRequestParams alloc] initWithParams:params];
    [gself.userInfoView addCryptocurrency:requestParams.c targetBlock:^(KBRCryptocurrency *cryptocurrency) {

    }];
    [gself setNeedsLayout];

    [gself updateWindow];
    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.finishWebProofCheck" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRFinishWebProofCheckRequestParams *requestParams = [[KBRFinishWebProofCheckRequestParams alloc] initWithParams:params];
    KBRRemoteProof *proof = requestParams.rp;
    KBRLinkCheckResult *lcr = requestParams.lcr;
    [gself.userInfoView updateProofResult:[KBProofResult proofResultForProof:proof result:lcr]];
    [self setNeedsLayout];

    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.finishSocialProofCheck" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRFinishSocialProofCheckRequestParams *requestParams = [[KBRFinishSocialProofCheckRequestParams alloc] initWithParams:params];
    KBRRemoteProof *proof = requestParams.rp;
    KBRLinkCheckResult *lcr = requestParams.lcr;
    [gself.userInfoView updateProofResult:[KBProofResult proofResultForProof:proof result:lcr]];
    [self setNeedsLayout];
    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.finishAndPrompt" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {

    if (approve) {
      KBRFinishAndPromptRes *response = [[KBRFinishAndPromptRes alloc] init];
      response.trackRemote = YES;
      completion(nil, response);
    } else {
      completion(nil, nil);
    }
  }];

  [client registerMethod:@"keybase.1.identifyUi.finish" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.reportLastTrack" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    // TODO Show this?
    completion(nil, nil);
  }];
}

- (void)reload {
  [self setUsername:self.username client:self.client];
}

- (BOOL)isLoadingUsername:(NSString *)username {
  return [_username isEqualToString:username] && _loading;
}

- (void)showTrack:(KBRIdentifyRes *)identify {
  self.trackView.hidden = NO;
  GHWeakSelf gself = self;
  BOOL trackPrompt = [self.trackView setUsername:identify.user.username popup:self.popup identifyOutcome:identify.outcome trackResponse:^(NSString *username) {
    [gself track:identify.user.username];
  }];
  [self setNeedsLayout];

  if (self.popup && trackPrompt && !self.window) {
    [self openPopup:self];
  }

  if (!trackPrompt) {
    DDLogDebug(@"No track prompt required");
  }
}

- (void)track:(NSString *)username {
  KBRTrackRequest *request = [[KBRTrackRequest alloc] initWithClient:self.client];
  GHWeakSelf gself = self;
  [KBActivity setProgressEnabled:YES sender:self];
  [self registerClient:self.client sessionId:request.sessionId approve:YES sender:self];
  [request trackWithSessionID:request.sessionId theirName:username localOnly:NO approveRemote:YES completion:^(NSError *error) {
    [KBActivity setProgressEnabled:NO sender:self];
    [gself showTrackResult:username error:error];
  }];
}

- (void)showTrackResult:(NSString *)username error:(NSError *)error {
  [self.trackView setTrackCompleted:error];

  dispatch_async(dispatch_get_main_queue(), ^{
    [NSNotificationCenter.defaultCenter postNotificationName:KBTrackingListDidChangeNotification object:nil userInfo:@{@"username": username}];
  });

  if (self.popup) {
    [[self window] close];
  }
}

- (void)identify {
  [self.headerView setProgressEnabled:YES];
  _loading = YES;
  GHWeakSelf gself = self;
  KBRIdentifyRequest *identifyRequest = [[KBRIdentifyRequest alloc] initWithClient:self.client];
  [self registerClient:self.client sessionId:identifyRequest.sessionId sender:self];
  [identifyRequest identifyDefaultWithSessionID:identifyRequest.sessionId userAssertion:_username completion:^(NSError *error, KBRIdentifyRes *identifyRes) {
    [gself.headerView setProgressEnabled:NO];
    gself.loading = NO;
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }

    NSAssert([identifyRes.user.username isEqualTo:gself.username], @"Mismatched users");

    BOOL isSelf = [AppDelegate.appView.user.username isEqual:identifyRes.user.username];
    if (isSelf) {
      DDLogDebug(@"Viewing self");
      return;
    }

    [self showTrack:identifyRes];
  }];
}

- (void)identifySelf {
  [self.headerView setProgressEnabled:YES];
  _loading = YES;
  GHWeakSelf gself = self;
  KBRIdentifyRequest *identifyRequest = [[KBRIdentifyRequest alloc] initWithClient:self.client];
  [self registerClient:self.client sessionId:identifyRequest.sessionId sender:self];
  [identifyRequest identifyDefaultWithSessionID:identifyRequest.sessionId userAssertion:_username completion:^(NSError *error, KBRIdentifyRes *identifyRes) {
    [gself.headerView setProgressEnabled:NO];
    gself.loading = NO;
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }

    [gself.userInfoView addHeader:@" " text:@" " targetBlock:^{}];

    if ([gself.fokids count] == 0) {
      [gself.userInfoView addHeader:@" " text:@"Add a PGP Key" targetBlock:^{
        [gself addPGPKey];
      }];
    }

    for (NSString *serviceName in [gself.userInfoView missingServices]) {
      if ([serviceName isEqualTo:@"dns"]) {
        [gself.userInfoView addHeader:@" " text:@"Add Domain" targetBlock:^{ [gself connectWithServiceName:serviceName proofResult:nil]; }];
      } else if ([serviceName isEqualTo:@"http"]) {
        [gself.userInfoView addHeader:@" " text:@"Add Website" targetBlock:^{ [gself connectWithServiceName:serviceName proofResult:nil]; }];
      } else {
        [gself.userInfoView addHeader:@" " text:NSStringWithFormat(@"Connect to %@", KBNameForServiceName(serviceName)) targetBlock:^{ [gself connectWithServiceName:serviceName proofResult:nil]; }];
      }
    }
    [self setNeedsLayout];
  }];
}

- (void)refresh {
  [self setUsername:_username client:self.client];
}

- (void)setUsername:(NSString *)username client:(KBRPClient *)client {
  NSParameterAssert(client);
  if ([self isLoadingUsername:username]) return;
  NSAssert(!_loading, @"In progress");

  [self clear];

  self.client = client;
  _username = username;
  _fokids = nil;

  if (!_username) return;

  BOOL isSelf = [AppDelegate.appView.user.username isEqual:username];

  [_headerView setUsername:_username];
  _headerView.hidden = NO;

  if (!isSelf) {
    [self identify];
  } else {
    [self identifySelf];
  }

  [self setNeedsLayout];
}

- (void)untrack {
  [self.headerView setProgressEnabled:YES];
  KBRTrackRequest *request = [[KBRTrackRequest alloc] initWithClient:self.client];
  GHWeakSelf gself = self;
  [request untrackWithSessionID:request.sessionId theirName:_username completion:^(NSError *error) {
    [self.headerView setProgressEnabled:NO];
    if (error) {
      [AppDelegate setError:error sender:self];
      return;
    }

    dispatch_async(dispatch_get_main_queue(), ^{
      [NSNotificationCenter.defaultCenter postNotificationName:KBTrackingListDidChangeNotification object:nil userInfo:@{@"username": gself.username}];
    });
  }];
}

#pragma mark Add PGP

- (void)addPGPKey {
  KBRConfigRequest *request = [[KBRConfigRequest alloc] initWithClient:self.client];
  [request getConfigWithSessionID:request.sessionId completion:^(NSError *error, KBRConfig *config) {
    KBAlertView *alert = [[KBAlertView alloc] init];
    [alert addButtonWithTitle:@"Import Manually" tag:1];
    if (config.gpgExists) [alert addButtonWithTitle:@"Import from GPG" tag:2];
    [alert addButtonWithTitle:@"Generate New Key" tag:3];
    [alert addButtonWithTitle:@"Cancel" tag:5];

    [alert setMessageText:@"Already have a PGP key?"];
    [alert setInformativeText:@"Would you like to import a key, or generate a new one?"];
    [alert showInView:self completion:^(NSInteger tag) {
      if (tag == 2) {
        [self selectGPGKey];
      } else if (tag == 1) {
        [self importKey];
      } else if (tag == 3) {
        [self generatePGPKey];
      }
    }];
  }];
}

- (void)openKeyWithKeyId:(KBRFOKID *)keyId {
  KBKeyView *keyView = [[KBKeyView alloc] init];
  NSWindow *window = [self.window kb_addChildWindowForView:keyView rect:CGRectMake(0, 0, 500, 400) position:KBWindowPositionCenter title:@"Key" fixed:NO makeKey:YES];
  keyView.cancelButton.targetBlock = ^{
    [window close];
  };
  keyView.client = self.client;
  BOOL isSelf = [AppDelegate.appView.user.username isEqual:self.username];
  [keyView setKeyId:keyId editable:isSelf];
}

- (void)generatePGPKey {
  KBProgressView *progressView = [[KBProgressView alloc] init];
  [progressView setProgressTitle:@"Generating"];
  progressView.work = ^(KBCompletion completion) {
    KBRPgpCreateUids *uids = [[KBRPgpCreateUids alloc] init];
    uids.useDefault = YES;
    KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];
    [request pgpKeyGenDefaultWithSessionID:request.sessionId createUids:uids completion:^(NSError *error) {
      completion(error);
      [self reload];
    }];
  };
  [progressView openAndDoIt:self];
}

- (void)selectGPGKey {
  KBRPgpRequest *request = [[KBRPgpRequest alloc] initWithClient:self.client];
  [self.client registerMethod:@"keybase.1.gpgUi.selectKeyAndPushOption" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRSelectKeyAndPushOptionRequestParams *requestParams = [[KBRSelectKeyAndPushOptionRequestParams alloc] initWithParams:params];
    [self selectPGPKey:requestParams completion:completion];
  }];
  [request pgpSelectWithSessionID:request.sessionId query:nil allowMulti:NO skipImport:NO completion:^(NSError *error) {
    [AppDelegate setError:error sender:self];
    [self reload];
  }];
}

- (void)selectPGPKey:(KBRSelectKeyAndPushOptionRequestParams *)handler completion:(MPRequestCompletion)completion {
  KBKeySelectView *selectView = [[KBKeySelectView alloc] init];
  selectView.client = self.client;

  [(KBWindow *)self.window addModalWindowForView:selectView rect:CGRectMake(0, 0, 620, 420)];

  [selectView setGPGKeys:handler.keys];
  selectView.completion = ^(id sender, id result) {
    [[sender window] close];
    completion(nil, result);
  };
}

- (void)importKey {
  KBKeyImportView *importView = [[KBKeyImportView alloc] init];
  importView.client = self.client;
  [(KBWindow *)self.window addModalWindowForView:importView rect:CGRectMake(0, 0, 620, 420)];
  importView.completion = ^(id sender, BOOL imported) {
    if (imported) [self refresh];
    [[sender window] close];
  };
}

@end

@interface KBUserProfileViewer ()
@property KBUserProfileView *view;
@end


@implementation KBUserProfileViewer

- (void)viewInit {
  [super viewInit];
  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    [layout setSize:size view:yself.view options:0];
    return size;
  }];
  [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(update:) name:KBTrackingListDidChangeNotification object:nil];
}

- (void)dealloc {
  [NSNotificationCenter.defaultCenter removeObserver:self];
}

- (void)update:(NSNotification *)notification {
  if ([notification.userInfo[@"username"] isEqualToString:_view.username]) {
    [_view reload];
  }
}

- (void)clear {
  [_view clear];
}

- (void)setUsername:(NSString *)username client:(KBRPClient *)client {
  if (!username) {
    [_view removeFromSuperview];
    _view = nil;
    return;
  }

  if ([_view isLoadingUsername:username]) return;

  // Check if we need  a new view
  if (!_view || [_view isLoading]) {
    [_view removeFromSuperview];
    _view = [[KBUserProfileView alloc] init];
    [self setNeedsLayout];
  }
  if (![_view superview]) [self addSubview:_view];

  [_view setUsername:username client:client];
}

@end