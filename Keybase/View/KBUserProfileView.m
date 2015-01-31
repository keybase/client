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

@interface KBUserProfileView ()
@property NSScrollView *scrollView;
@property KBUserHeaderView *headerView;
@property KBUserInfoView *userInfoView;
@property KBTrackView *trackView;
@property KBRUser *user;
@end

@implementation KBUserProfileView

- (void)viewInit {
  [super viewInit];
  
  _headerView = [[KBUserHeaderView alloc] init];
  _userInfoView = [[KBUserInfoView alloc] init];
  _trackView = [[KBTrackView alloc] init];
  KBView *view = [[KBView alloc] init];
  [view addSubview:_headerView];
  [view addSubview:_userInfoView];
  [view addSubview:_trackView];

  YOSelf yself = self;
  view.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    //CGSize headerSize = [yself.headerView sizeThatFits:CGSizeMake(MIN(400, size.width) - 20, size.height)];
    //y += [layout centerWithSize:headerSize frame:CGRectMake(0, y, MIN(400, size.width), headerSize.height) view:yself.headerView].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width - 20, 0) view:yself.headerView].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.userInfoView].size.height;
    y += [layout sizeToFitVerticalInFrame:CGRectMake(0, y, size.width, 0) view:yself.trackView].size.height;
    return CGSizeMake(size.width, y);
  }];

  _scrollView = [[NSScrollView alloc] init];
  [_scrollView setHasVerticalScroller:YES];
  [_scrollView setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];
  [self addSubview:_scrollView];

  [_scrollView setDocumentView:view];
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width, CGFLOAT_MAX) view:view];
    [layout setSize:size view:yself.scrollView options:0];
    return size;
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.displayKey" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRFOKID *fokid = [MTLJSONAdapter modelOfClass:KBRFOKID.class fromJSONDictionary:params[0][@"fokid"] error:nil];
    [yself.userInfoView addKey:fokid];
    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.launchNetworkChecks" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {    
    KBRIdentity *identity = [MTLJSONAdapter modelOfClass:KBRIdentity.class fromJSONDictionary:params[0][@"id"] error:nil];
    //GHDebug(@"Identity: %@", identity);
    [yself.userInfoView addIdentityProofs:identity.proofs targetBlock:^(KBProofLabel *proofLabel) {
      [yself openURLString:proofLabel.proofResult.result.hint.humanUrl];
    }];
    [yself setNeedsLayout];

    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.finishWebProofCheck" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"%@", params);
    KBRRemoteProof *proof = [MTLJSONAdapter modelOfClass:KBRRemoteProof.class fromJSONDictionary:params[0][@"rp"] error:nil];
    KBRLinkCheckResult *lcr = [MTLJSONAdapter modelOfClass:KBRLinkCheckResult.class fromJSONDictionary:params[0][@"lcr"] error:nil];
    [yself.userInfoView updateProofResult:[KBProofResult proofResultForProof:proof result:lcr]];
    [self setNeedsLayout];

    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.finishSocialProofCheck" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    GHDebug(@"%@", params);
    KBRRemoteProof *proof = [MTLJSONAdapter modelOfClass:KBRRemoteProof.class fromJSONDictionary:params[0][@"rp"] error:nil];
    KBRLinkCheckResult *lcr = [MTLJSONAdapter modelOfClass:KBRLinkCheckResult.class fromJSONDictionary:params[0][@"lcr"] error:nil];
    [yself.userInfoView updateProofResult:[KBProofResult proofResultForProof:proof result:lcr]];
    [self setNeedsLayout];
    completion(nil, nil);
  }];


  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.displayCryptocurrency" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRCryptocurrency *cryptocurrency = [MTLJSONAdapter modelOfClass:KBRCryptocurrency.class fromJSONDictionary:params[0][@"c"] error:nil];
    [yself.userInfoView addCryptocurrency:cryptocurrency];
    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.finishAndPrompt" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    //[yself.navigation.titleView setProgressEnabled:NO];
    [yself.headerView setProgressEnabled:NO];
    KBRIdentifyOutcome *identifyOutcome = [MTLJSONAdapter modelOfClass:KBRIdentifyOutcome.class fromJSONDictionary:params[0][@"outcome"] error:nil];
    yself.trackView.hidden = NO;
    BOOL trackPrompt = [yself.trackView setUser:yself.user identifyOutcome:identifyOutcome trackResponse:^(KBRFinishAndPromptRes *response) {
      [KBView setInProgress:YES view:yself.trackView];
      completion(nil, response);
    }];
    [yself setNeedsLayout];

    if (!trackPrompt) {
      GHDebug(@"No track prompt required");
      completion(nil, nil);
    }
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.reportLastTrack" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, nil);
  }];
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
  [super setError:error];
  // TODO: Redo track process (if failed on track)
}

- (void)setUser:(KBRUser *)user track:(BOOL)track {
  NSAssert(self.navigation, @"No navigation, push before setting user");
  _user = user;
  //_headerView.hidden = NO;
  [_headerView setUser:user];
  [_userInfoView clear];
  [_trackView clear];
  _trackView.hidden = YES;
  [self setNeedsLayout];

  GHWeakSelf gself = self;

  if (track) {
    //[self.navigation.titleView setProgressEnabled:YES];
    [self.headerView setProgressEnabled:YES];
    KBRTrackRequest *trackRequest = [[KBRTrackRequest alloc] initWithClient:AppDelegate.client];
    [trackRequest trackWithTheirName:user.username completion:^(NSError *error) {
      //[gself.navigation.titleView setProgressEnabled:NO];
      [gself.headerView setProgressEnabled:NO];
      [KBView setInProgress:NO view:gself.trackView];
      if (![gself.trackView setTrackCompleted:error]) {
        [self setError:error];
      }
      [self setNeedsLayout];
    }];
  }

  //self.progressIndicatorEnabled = YES;
  [AppDelegate.APIClient userForKey:@"usernames" value:user.username fields:nil success:^(KBUser *user) {
    //self.progressIndicatorEnabled = NO;
    [self.headerView setUserInfo:user];
    [self setNeedsLayout];
  } failure:^(NSError *error) {
    [self setError:error];
  }];

  [self setNeedsLayout];
}

@end
