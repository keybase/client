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
#import "KBRUtils.h"
#import "KBProofResult.h"
#import "KBErrorView.h"
#import "KBTrackView.h"
//#import "KBWebView.h"
#import "KBProgressOverlayView.h"
#import "KBProveView.h"
#import "KBRPClient.h"
#import "KBKeySelectView.h"
#import "KBKeyGenView.h"

@interface KBUserProfileView ()
@property NSScrollView *scrollView;
@property KBUserHeaderView *headerView;
@property KBUserInfoView *userInfoView;
@property KBTrackView *trackView;

@property KBRUser *user;
@property BOOL editable;
@property id<KBRPClient> client;

@property KBRFOKID *fokid;

@property YONSView *contentView;
@end

@implementation KBUserProfileView

- (void)viewInit {
  [super viewInit];
  
  _headerView = [[KBUserHeaderView alloc] init];
  _userInfoView = [[KBUserInfoView alloc] init];
  _trackView = [[KBTrackView alloc] init];
  _contentView = [[YONSView alloc] init];
  [_contentView addSubview:_headerView];
  [_contentView addSubview:_userInfoView];
  [_contentView addSubview:_trackView];

  YOSelf yself = self;
  _contentView.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 10;
    //CGSize headerSize = [yself.headerView sizeThatFits:CGSizeMake(MIN(400, size.width) - 20, size.height)];
    //y += [layout centerWithSize:headerSize frame:CGRectMake(0, y, MIN(400, size.width), headerSize.height) view:yself.headerView].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width - 20, 0) view:yself.headerView].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.userInfoView].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.trackView].size.height;
    return CGSizeMake(size.width, y);
  }];

  _scrollView = [[NSScrollView alloc] init];
  _scrollView.hasVerticalScroller = YES;
  _scrollView.autohidesScrollers = YES;
  [_scrollView setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];
  [_scrollView setDocumentView:_contentView];
  [self addSubview:_scrollView];

  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width, CGFLOAT_MAX) view:yself.contentView];
    [layout setSize:size view:yself.scrollView options:0];
    return size;
  }];
}

- (void)updateWindow {
  if (!_popup) return;

  // If we are in a popup lets adjust our window so all the content is visible
  [self layoutView];
  CGSize size = CGSizeMake(_contentView.frame.size.width, _contentView.frame.size.height + 40);
  // Only make it bigger (not smaller)
  if (size.height > self.window.frame.size.height) {
    CGRect frame = CGRectMake(self.window.frame.origin.x, self.window.frame.origin.y, size.width, size.height);
    [self.window setFrame:frame display:YES];
  }
}

- (void)openURLString:(NSString *)URLString {
  NSAlert *alert = [[NSAlert alloc] init];
  [alert addButtonWithTitle:@"Open"];
  [alert addButtonWithTitle:@"Cancel"];
  [alert setMessageText:@"Open a Link"];
  [alert setInformativeText:NSStringWithFormat(@"Do you want to open %@?", URLString)];
  [alert beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse returnCode) {
    if (returnCode == NSAlertFirstButtonReturn) {
      [NSWorkspace.sharedWorkspace openURL:[NSURL URLWithString:URLString]];
    }
  }];
}

- (void)setError:(NSError *)error {
  [AppDelegate setError:error sender:self];
}

- (void)clear {
  _user = nil;
  _headerView.hidden = YES;
  [_userInfoView clear];
  [_trackView clear];
  _trackView.hidden = YES;
  [self setNeedsLayout];
}

- (void)connectWithProveType:(KBProveType)proveType {
  GHWeakSelf gself = self;
  [KBProveView connectWithProveType:proveType client:self.client sender:self completion:^(BOOL canceled) {
    if (!canceled) [gself reload];
  }];
}

- (void)reload {
  [self setUser:self.user editable:self.editable client:self.client];
}

- (void)registerClient:(id<KBRPClient>)client sessionId:(NSInteger)sessionId {
  GHWeakSelf gself = self;
  [client registerMethod:@"keybase.1.identifyUi.displayKey" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRDisplayKeyRequestParams *requestParams = [[KBRDisplayKeyRequestParams alloc] initWithParams:params];
    gself.fokid = requestParams.fokid;
    if (requestParams.fokid.pgpFingerprint) {
      [gself.userInfoView addKey:requestParams.fokid];
      [gself setNeedsLayout];
    }

    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.launchNetworkChecks" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRLaunchNetworkChecksRequestParams *requestParams = [[KBRLaunchNetworkChecksRequestParams alloc] initWithParams:params];
    [gself.headerView setUser:requestParams.user];
    [gself.userInfoView addProofs:requestParams.id.proofs editable:gself.editable targetBlock:^(KBProofLabel *proofLabel) {
      if (proofLabel.proofResult.result.proofStatus.status != 1) {
        // Fix it?
        [self connectWithProveType:KBProveTypeFromAPI(proofLabel.proofResult.proof.proofType)];
      } else if (proofLabel.proofResult.result.hint.humanUrl) {
        [gself openURLString:proofLabel.proofResult.result.hint.humanUrl];
      }
    }];
    [gself setNeedsLayout];
    [gself updateWindow];

    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.displayCryptocurrency" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRDisplayCryptocurrencyRequestParams *requestParams = [[KBRDisplayCryptocurrencyRequestParams alloc] initWithParams:params];
    [gself.userInfoView addCryptocurrency:requestParams.c];
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
    //[yself.navigation.titleView setProgressEnabled:NO];
    [gself.headerView setProgressEnabled:NO];

    if (gself.editable) {
      GHDebug(@"Editable (not tracking, identify)");
      completion(nil, nil);
      return;
    }

    KBRFinishAndPromptRequestParams *requestParams = [[KBRFinishAndPromptRequestParams alloc] initWithParams:params];
    gself.trackView.hidden = NO;
    BOOL trackPrompt = [gself.trackView setUser:gself.user popup:gself.popup identifyOutcome:requestParams.outcome trackResponse:^(KBRFinishAndPromptRes *response) {
      [KBNavigationView setProgressEnabled:YES subviews:gself.trackView.subviews];
      completion(nil, response);
    }];
    [gself setNeedsLayout];

    if (!trackPrompt) {
      GHDebug(@"No track prompt required");
      completion(nil, nil);
    }
  }];

  [client registerMethod:@"keybase.1.identifyUi.reportLastTrack" sessionId:sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, nil);
  }];
}

- (void)setUser:(KBRUser *)user editable:(BOOL)editable client:(id<KBRPClient>)client {
  [self clear];

  _user = user;
  _editable = editable;
  _client = client;
  
  [_headerView setUser:_user];
  _headerView.hidden = NO;

  GHWeakSelf gself = self;

  if (!_editable) {
    // For others
    [self.headerView setProgressEnabled:YES];
    KBRTrackRequest *trackRequest = [[KBRTrackRequest alloc] initWithClient:client];
    [self registerClient:client sessionId:trackRequest.sessionId];
    [trackRequest trackWithSessionID:trackRequest.sessionId theirName:user.username completion:^(NSError *error) {
      [gself setTrackCompleted:error];
    }];
  } else {
    // For ourself
    [self.headerView setProgressEnabled:YES];
    KBRIdentifyRequest *identifyRequest = [[KBRIdentifyRequest alloc] initWithClient:client];
    [self registerClient:client sessionId:identifyRequest.sessionId];
    [identifyRequest identifyDefaultWithSessionID:identifyRequest.sessionId username:user.username completion:^(NSError *error, KBRIdentifyRes *identifyRes) {
      [gself.headerView setProgressEnabled:NO];
      if (error) {
        [AppDelegate setError:error sender:nil];
        return;
      }

      [gself.userInfoView addHeader:@" " text:@" " targetBlock:^{}];

      if (!gself.fokid.pgpFingerprint) {
        [gself.userInfoView addHeader:@" " text:@"Add a PGP Key" targetBlock:^{
          [gself addPGPKey];
        }];
      }

      for (NSNumber *proveTypeNumber in [gself.userInfoView missingProveTypes]) {
        KBProveType proveType = [proveTypeNumber integerValue];

        switch (proveType) {
          case KBProveTypeDNS: {
            [gself.userInfoView addHeader:@" " text:@"Add Domain" targetBlock:^{ [gself connectWithProveType:proveType]; }];
            break;
          }
          case KBProveTypeHTTPS: {
            [gself.userInfoView addHeader:@" " text:@"Add Website" targetBlock:^{ [gself connectWithProveType:proveType]; }];
            break;
          }
          case KBProveTypeTwitter:
          case KBProveTypeGithub:
          case KBProveTypeReddit:
          case KBProveTypeCoinbase:
          case KBProveTypeHackernews: {
            [gself.userInfoView addHeader:@" " text:NSStringWithFormat(@"Connect to %@", KBDescriptionForProveType(proveType)) targetBlock:^{ [gself connectWithProveType:proveType]; }];
            break;
          }
          case KBProveTypeUnknown:
            break;
        }
      }
      [self setNeedsLayout];
    }];
  }

  [self setNeedsLayout];
}

- (void)setTrackCompleted:(NSError *)error {
  [_headerView setProgressEnabled:NO];
  [KBNavigationView setProgressEnabled:NO subviews:_trackView.subviews];
  if (![_trackView setTrackCompleted:error]) {
    if (error) [self setError:error];
  }
  [self setNeedsLayout];
}

#pragma mark Add PGP

- (void)addPGPKey {
  KBRConfigRequest *request = [[KBRConfigRequest alloc] initWithClient:self.client];
  [request getConfig:^(NSError *error, KBRConfig *config) {
    KBAlert *alert = [[KBAlert alloc] init];
    [alert addButtonWithTitle:@"Import Manually" tag:1];
    if (config.gpgExists) [alert addButtonWithTitle:@"Import from GPG" tag:2];
    [alert addButtonWithTitle:@"Generate New Key" tag:3];
    [alert addButtonWithTitle:@"Cancel" tag:5];
    [alert setMessageText:@"Already have a PGP key?"];
    [alert setInformativeText:@"Would you like to import a key, or generate a new one?"];
    [alert setAlertStyle:NSInformationalAlertStyle];
    [alert showInView:self completion:^(NSModalResponse response) {
      if (response == 2) {
        [self selectGPGKey];
      } else if (response == 1) {
        // TODO
      } else if (response == 3) {
        [self generateNewKey];
      }
    }];
  }];
}

- (void)generateNewKey {
  KBKeyGenView *view = [[KBKeyGenView alloc] init];
  NSWindow *window = [KBWindow windowWithContentView:view size:CGSizeMake(600, 400) retain:NO];
  view.completion = ^{
    [self.window endSheet:window];
  };
  view.cancelButton.actionBlock = ^(id sender) { [self.window endSheet:window]; };
  [self.window beginSheet:window completionHandler:^(NSModalResponse returnCode) {}];
}

- (void)selectGPGKey {
  KBRMykeyRequest *request = [[KBRMykeyRequest alloc] initWithClient:self.client];
  [self.client registerMethod:@"keybase.1.gpgUi.selectKeyAndPushOption" sessionId:request.sessionId requestHandler:^(NSNumber *messageId, NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRSelectKeyAndPushOptionRequestParams *requestParams = [[KBRSelectKeyAndPushOptionRequestParams alloc] initWithParams:params];
    [self selectPGPKey:requestParams completion:completion];
  }];
  [request selectWithQuery:nil allowMulti:NO skipImport:NO completion:^(NSError *error) {
    if (error) [self setError:error];
    //[self reload];
  }];
}

- (void)selectPGPKey:(KBRSelectKeyAndPushOptionRequestParams *)handler completion:(MPRequestCompletion)completion {
  KBKeySelectView *selectView = [[KBKeySelectView alloc] init];

  NSWindow *window = [KBWindow windowWithContentView:selectView size:CGSizeMake(600, 400) retain:NO];

  [selectView setGPGKeys:handler.keys completion:^(NSError *error, id result) {
    [self.window endSheet:window];
    completion(error, result);
  }];
  //[self.navigation setView:selectView transitionType:KBNavigationTransitionTypeFade];

  selectView.cancelButton.actionBlock = ^(id sender) { [self.window endSheet:window]; };
  [self.window beginSheet:window completionHandler:^(NSModalResponse returnCode) {}];
}

@end
