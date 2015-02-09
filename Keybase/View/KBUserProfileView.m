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

@interface KBUserProfileView ()
@property NSScrollView *scrollView;
@property KBUserHeaderView *headerView;
@property KBUserInfoView *userInfoView;
@property KBTrackView *trackView;

@property KBRUser *user;
@property BOOL track;

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

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.displayKey" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRFOKID *fokid = [MTLJSONAdapter modelOfClass:KBRFOKID.class fromJSONDictionary:params[0][@"fokid"] error:nil];
    [yself.userInfoView addKey:fokid];
    [yself setNeedsLayout];

    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.launchNetworkChecks" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {    
    KBRIdentity *identity = [MTLJSONAdapter modelOfClass:KBRIdentity.class fromJSONDictionary:params[0][@"id"] error:nil];
    //GHDebug(@"Identity: %@", identity);
    [yself.userInfoView addIdentity:identity targetBlock:^(KBProofLabel *proofLabel) {
      if (proofLabel.proofResult.result.hint.humanUrl) [yself openURLString:proofLabel.proofResult.result.hint.humanUrl];
    }];
    [yself setNeedsLayout];
    [yself updateWindow];

    completion(nil, nil);
  }];

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.displayCryptocurrency" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    KBRCryptocurrency *cryptocurrency = [MTLJSONAdapter modelOfClass:KBRCryptocurrency.class fromJSONDictionary:params[0][@"c"] error:nil];
    [yself.userInfoView addCryptocurrency:cryptocurrency];
    [yself setNeedsLayout];

    [yself updateWindow];
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

  [AppDelegate.client registerMethod:@"keybase.1.identifyUi.finishAndPrompt" requestHandler:^(NSString *method, NSArray *params, MPRequestCompletion completion) {
    //[yself.navigation.titleView setProgressEnabled:NO];
    [yself.headerView setProgressEnabled:NO];

    if (!yself.track) {
      GHDebug(@"Not tracking (identify)");
      completion(nil, nil);
      return;
    }

    KBRIdentifyOutcome *identifyOutcome = [MTLJSONAdapter modelOfClass:KBRIdentifyOutcome.class fromJSONDictionary:params[0][@"outcome"] error:nil];
    yself.trackView.hidden = NO;
    BOOL trackPrompt = [yself.trackView setUser:yself.user popup:yself.popup identifyOutcome:identifyOutcome trackResponse:^(KBRFinishAndPromptRes *response) {
      [AppDelegate setInProgress:YES view:yself.trackView];
      if (yself.mock) {
        [yself setTrackCompleted:nil];
      } else {
        completion(nil, response);
      }
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

- (void)setUser:(KBRUser *)user track:(BOOL)track {
  [self clear];

  _user = user;
  _track = track;
  [_headerView setUser:_user];
  _headerView.hidden = NO;

  GHWeakSelf gself = self;

  if (track) {
    //[self.navigation.titleView setProgressEnabled:YES];
    [self.headerView setProgressEnabled:YES];
    KBRTrackRequest *trackRequest = [[KBRTrackRequest alloc] initWithClient:AppDelegate.client];
    [trackRequest trackWithTheirName:user.username completion:^(NSError *error) {
      [gself setTrackCompleted:error];
    }];
  } else {
    // For ourself
    [self.headerView setProgressEnabled:YES];
    KBRIdentifyRequest *identifyRequest = [[KBRIdentifyRequest alloc] initWithClient:AppDelegate.client];
    [identifyRequest identifyDefaultWithUsername:user.username completion:^(NSError *error, KBRIdentifyRes *identifyRes) {
      [gself.headerView setProgressEnabled:NO];

      for (NSNumber *proveTypeNumber in [gself.userInfoView missingProveTypes]) {
        KBProveType proveType = [proveTypeNumber integerValue];
        [gself.userInfoView addConnectWithTypeName:KBNameForProveType(proveType) targetBlock:^{
          [KBProveView connectWithProveType:proveType sender:gself completion:^(BOOL canceled) {
            // Reload
            [gself setUser:user track:NO];
          }];
        }];
      }
      [self setNeedsLayout];
    }];
  }

  [self setNeedsLayout];
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
