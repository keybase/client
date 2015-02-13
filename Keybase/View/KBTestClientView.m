//
//  KBTestClientView.m
//  Keybase
//
//  Created by Gabriel on 2/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBTestClientView.h"

@interface KBTestClientView ()
@property KBRPClient *client;
@property KBButton *connectButton;
@property KBTextCollectionView *infoView;
@end

@implementation KBTestClientView

- (void)viewInit {
  [super viewInit];

  GHWeakSelf gself = self;
  _connectButton = [KBButton buttonWithText:@"Connect" style:KBButtonStylePrimary];
  _connectButton.targetBlock = ^{ [gself open]; };
  [self addSubview:_connectButton];

  _infoView = [[KBTextCollectionView alloc] init];
  [self addSubview:_infoView];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^CGSize(id<YOLayout> layout, CGSize size) {
    CGFloat y = 20;
    y += [layout setSize:CGSizeMake(200, 0) inRect:CGRectMake(0, y, size.width, 0) view:yself.connectButton options:YOLayoutOptionsSizeToFit| YOLayoutOptionsAlignCenter].size.height + 10;

    [layout setFrame:CGRectMake(20, y, size.width - 40, size.height - y - 20) view:yself.infoView];

    return CGSizeMake(size.width, size.height);
  }];
}

- (void)open {
  _client = [[KBRPClient alloc] init];
  _client.autoRetryDisabled = YES;
  _client.delegate = self;
  [_client open];
}

- (void)close {
  [_client close];
}

- (void)RPClientDidConnect:(KBRPClient *)RPClient {
  GHWeakSelf gself = self;
  [_connectButton setText:@"Disconnect" style:KBButtonStyleDefault alignment:NSCenterTextAlignment];
  _connectButton.targetBlock = ^{ [gself close]; };
  [_infoView addObjects:@[@"Connected"]];
}

- (void)RPClientDidDisconnect:(KBRPClient *)RPClient {
  GHWeakSelf gself = self;
  [_connectButton setText:@"Connect" style:KBButtonStyleDefault alignment:NSCenterTextAlignment];
  _connectButton.targetBlock = ^{ [gself open]; };
}

- (void)RPClient:(KBRPClient *)RPClient didErrorOnConnect:(NSError *)error {
  [_infoView addObjects:@[error.localizedDescription]];
}

@end
