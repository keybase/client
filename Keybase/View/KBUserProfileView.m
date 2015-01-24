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

@interface KBUserProfileView ()
@property NSScrollView *scrollView;
@property KBUserHeaderView *headerView;
@property KBUserInfoView *proofsView;
@end

@implementation KBUserProfileView

- (void)viewInit {
  [super viewInit];
  
  _headerView = [[KBUserHeaderView alloc] init];
  _proofsView = [[KBUserInfoView alloc] init];
  KBView *view = [[KBView alloc] init];
  [view addSubview:_headerView];
  [view addSubview:_proofsView];
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
    //GHDebug(@"%@", [params gh_toJSON:NSJSONWritingPrettyPrinted error:nil]);
    KBRFOKID *fokid = [MTLJSONAdapter modelOfClass:KBRFOKID.class fromJSONDictionary:params[0][@"fokid"] error:nil];
    GHDebug(@"fokid: %@", fokid);
    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.launchNetworkChecks" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    //GHDebug(@"%@", [params gh_toJSON:NSJSONWritingPrettyPrinted error:nil]);
    KBRIdentity *identity = [MTLJSONAdapter modelOfClass:KBRIdentity.class fromJSONDictionary:params[0][@"id"] error:nil];
    GHDebug(@"Identity: %@", identity);
    [yself.proofsView addIdentityProofs:identity.proofs];
    [yself setNeedsLayout];

    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.finishWebProofCheck" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRRemoteProof *proof = [MTLJSONAdapter modelOfClass:KBRRemoteProof.class fromJSONDictionary:params[0][@"rp"] error:nil];
    KBRLinkCheckResult *lcr = [MTLJSONAdapter modelOfClass:KBRLinkCheckResult.class fromJSONDictionary:params[0][@"lcr"] error:nil];
    [yself.proofsView updateProofResult:[KBProofResult proofResultForProof:proof result:lcr]];
    [self setNeedsLayout];

    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.finishSocialProofCheck" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRRemoteProof *proof = [MTLJSONAdapter modelOfClass:KBRRemoteProof.class fromJSONDictionary:params[0][@"rp"] error:nil];
    KBRLinkCheckResult *lcr = [MTLJSONAdapter modelOfClass:KBRLinkCheckResult.class fromJSONDictionary:params[0][@"lcr"] error:nil];
    [yself.proofsView updateProofResult:[KBProofResult proofResultForProof:proof result:lcr]];
    [self setNeedsLayout];

    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.finishAndPrompt" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.reportLastTrack" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    completion(nil, nil);
  }];
}

- (void)setUser:(KBRUser *)user {
  //_headerView.hidden = NO;
  [_headerView setUser:user];
  [_proofsView clear];
  [self setNeedsLayout];

  KBRIdentifyRequest *identify = [[KBRIdentifyRequest alloc] initWithClient:AppDelegate.client];
  //- (void)identifyDefaultWithUsername:(NSString *)username completion:(void (^)(NSError *error, KBIdentifyRes * identifyRes))completion;
  [identify identifyDefaultWithUsername:user.username completion:^(NSError *error, KBRIdentifyRes *identifyRes) {
    if (error) {
      GHErr(@"Error: %@", error);
      // TODO
    } else {
      GHDebug(@"Identified: %@", identifyRes);
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
