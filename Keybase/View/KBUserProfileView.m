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

@interface KBUserProfileView ()
@property NSScrollView *scrollView;
@property KBUserHeaderView *headerView;
@property KBUserInfoView *userInfoView;
@property KBTrackView *trackView;
@property KBErrorView *errorView;
@end

@implementation KBUserProfileView

- (void)viewInit {
  [super viewInit];
  
  _headerView = [[KBUserHeaderView alloc] init];
  _userInfoView = [[KBUserInfoView alloc] init];
  _trackView = [[KBTrackView alloc] init];
  _errorView = [[KBErrorView alloc] init];
  KBView *view = [[KBView alloc] init];
  [view addSubview:_headerView];
  [view addSubview:_userInfoView];
  [view addSubview:_trackView];
  [view addSubview:_errorView];
  view.viewLayout = [YOLayout vertical:view];

  _scrollView = [[NSScrollView alloc] init];
  [_scrollView setHasVerticalScroller:YES];
  [_scrollView setAutoresizingMask:NSViewWidthSizable|NSViewHeightSizable];
  [self addSubview:_scrollView];

  [_scrollView setDocumentView:view];
  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout sizeToFitVerticalInFrame:CGRectMake(0, 0, size.width, CGFLOAT_MAX) view:view];
    [layout setSize:size view:yself.scrollView];
    return size;
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.displayKey" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRFOKID *fokid = [MTLJSONAdapter modelOfClass:KBRFOKID.class fromJSONDictionary:params[0][@"fokid"] error:nil];
    [yself.userInfoView addKey:fokid];
    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.launchNetworkChecks" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRIdentity *identity = [MTLJSONAdapter modelOfClass:KBRIdentity.class fromJSONDictionary:params[0][@"id"] error:nil];
    GHDebug(@"Identity: %@", identity);
    [yself.userInfoView setProgressIndicatorEnabled:NO];
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
    completion(nil, nil);
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
  [_errorView setError:error];
}

- (void)setUser:(KBRUser *)user {
  //_headerView.hidden = NO;
  [_headerView setUser:user];
  [_userInfoView clear];
  [_trackView setIdentify:nil];
  [_errorView setError:nil];
  [self setNeedsLayout];

  GHWeakSelf gself = self;
  [_userInfoView setProgressIndicatorEnabled:YES];
  KBRIdentifyRequest *identify = [[KBRIdentifyRequest alloc] initWithClient:AppDelegate.client];
  [identify identifyDefaultWithUsername:user.username completion:^(NSError *error, KBRIdentifyRes *identifyRes) {
    if (error) {
      GHErr(@"Error: %@", error);
      [gself.errorView setError:error];
      [self setNeedsLayout];
    } else {
      GHDebug(@"Identified: %@", identifyRes);
      [gself.trackView setIdentify:identifyRes];
      [self setNeedsLayout];
    }
  }];

  //self.progressIndicatorEnabled = YES;
  [AppDelegate.APIClient userForKey:@"uids" value:[user.uid na_hexString] fields:nil success:^(KBUser *user) {
    //self.progressIndicatorEnabled = NO;
    [self.headerView setUserInfo:user];
    [self setNeedsLayout];
  } failure:^(NSError *error) {
    [self setError:error];
  }];

  [self setNeedsLayout];
}

@end
