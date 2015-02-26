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
  [KBProveView connectWithProveType:proveType sender:self completion:^(BOOL canceled) {
    if (!canceled) [gself reload];
  }];
}

- (void)reload {
  [self setUser:self.user editable:self.editable client:self.client];
}

- (void)registerClient:(id<KBRPClient>)client {
  GHWeakSelf gself = self;
  [client registerMethod:@"keybase.1.identifyUi.displayKey" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRFOKID *fokid = [MTLJSONAdapter modelOfClass:KBRFOKID.class fromJSONDictionary:params[0][@"fokid"] error:nil];
    gself.fokid = fokid;
    if (fokid.pgpFingerprint) {
      [gself.userInfoView addKey:fokid];
      [gself setNeedsLayout];
    }

    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.launchNetworkChecks" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRIdentity *identity = [MTLJSONAdapter modelOfClass:KBRIdentity.class fromJSONDictionary:params[0][@"id"] error:nil];
    //GHDebug(@"Identity: %@", identity);
    [gself.userInfoView addProofs:identity.proofs editable:gself.editable targetBlock:^(KBProofLabel *proofLabel) {
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

  [client registerMethod:@"keybase.1.identifyUi.displayCryptocurrency" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRCryptocurrency *cryptocurrency = [MTLJSONAdapter modelOfClass:KBRCryptocurrency.class fromJSONDictionary:params[0][@"c"] error:nil];
    [gself.userInfoView addCryptocurrency:cryptocurrency];
    [gself setNeedsLayout];

    [gself updateWindow];
    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.finishWebProofCheck" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"%@", params);
    KBRRemoteProof *proof = [MTLJSONAdapter modelOfClass:KBRRemoteProof.class fromJSONDictionary:params[0][@"rp"] error:nil];
    KBRLinkCheckResult *lcr = [MTLJSONAdapter modelOfClass:KBRLinkCheckResult.class fromJSONDictionary:params[0][@"lcr"] error:nil];
    [gself.userInfoView updateProofResult:[KBProofResult proofResultForProof:proof result:lcr]];
    [self setNeedsLayout];

    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.finishSocialProofCheck" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"%@", params);
    KBRRemoteProof *proof = [MTLJSONAdapter modelOfClass:KBRRemoteProof.class fromJSONDictionary:params[0][@"rp"] error:nil];
    KBRLinkCheckResult *lcr = [MTLJSONAdapter modelOfClass:KBRLinkCheckResult.class fromJSONDictionary:params[0][@"lcr"] error:nil];
    [gself.userInfoView updateProofResult:[KBProofResult proofResultForProof:proof result:lcr]];
    [self setNeedsLayout];
    completion(nil, nil);
  }];

  [client registerMethod:@"keybase.1.identifyUi.finishAndPrompt" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    //[yself.navigation.titleView setProgressEnabled:NO];
    [gself.headerView setProgressEnabled:NO];

    if (gself.editable) {
      GHDebug(@"Editable (not tracking, identify)");
      completion(nil, nil);
      return;
    }

    KBRIdentifyOutcome *identifyOutcome = [MTLJSONAdapter modelOfClass:KBRIdentifyOutcome.class fromJSONDictionary:params[0][@"outcome"] error:nil];
    gself.trackView.hidden = NO;
    BOOL trackPrompt = [gself.trackView setUser:gself.user popup:gself.popup identifyOutcome:identifyOutcome trackResponse:^(KBRFinishAndPromptRes *response) {
      [AppDelegate setInProgress:YES view:gself.trackView];
      completion(nil, response);
    }];
    [gself setNeedsLayout];

    if (!trackPrompt) {
      GHDebug(@"No track prompt required");
      completion(nil, nil);
    }
  }];

  [client registerMethod:@"keybase.1.identifyUi.reportLastTrack" owner:self requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, nil);
  }];
}

- (void)setUser:(KBRUser *)user editable:(BOOL)editable client:(id<KBRPClient>)client {
  [self clear];
  [self registerClient:client];

  _user = user;
  _editable = editable;
  _client = client;
  
  [_headerView setUser:_user];
  _headerView.hidden = NO;

  GHWeakSelf gself = self;

  if (!_editable) {
    //[self.navigation.titleView setProgressEnabled:YES];
    [self.headerView setProgressEnabled:YES];
    KBRTrackRequest *trackRequest = [[KBRTrackRequest alloc] initWithClient:client];
    [trackRequest trackWithTheirName:user.username completion:^(NSError *error) {
      [gself setTrackCompleted:error];
      [client unregister:gself];
    }];
  } else {
    // For ourself
    [self.headerView setProgressEnabled:YES];
    KBRIdentifyRequest *identifyRequest = [[KBRIdentifyRequest alloc] initWithClient:client];
    [identifyRequest identifyDefaultWithUsername:user.username completion:^(NSError *error, KBRIdentifyRes *identifyRes) {
      [gself.headerView setProgressEnabled:NO];
      [client unregister:gself];

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

- (void)addPGPKey {
  KBRGpgRequest *request = [[KBRGpgRequest alloc] initWithClient:AppDelegate.client];
  [request addGpgKey:^(NSError *error) {
    [self reload];
  }];
}

- (void)setTrackCompleted:(NSError *)error {
  //[gself.navigation.titleView setProgressEnabled:NO];
  [_headerView setProgressEnabled:NO];
  [AppDelegate setInProgress:NO view:_trackView];
  if (![_trackView setTrackCompleted:error]) {
    if (error) [self setError:error];
  }
  [self setNeedsLayout];
}

@end
