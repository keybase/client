//
//  KBDebugStatusView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDebugStatusView.h"

@interface KBDebugStatusView ()
@property KBLabel *RPCStatusLabel;
@property KBLabel *serverStatusLabel;
@end

@implementation KBDebugStatusView

- (void)viewInit {
  [super viewInit];
  
  _RPCStatusLabel = [[KBLabel alloc] init];
  _RPCStatusLabel.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:_RPCStatusLabel];

  _serverStatusLabel = [[KBLabel alloc] init];
  _serverStatusLabel.verticalAlignment = KBVerticalAlignmentMiddle;
  [self addSubview:_serverStatusLabel];

  KBBox *top = [KBBox line];
  [self addSubview:top];
  KBBox *border = [KBBox line];
  [self addSubview:border];
  KBBox *right = [KBBox line];
  [self addSubview:right];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat x = 10;
    [layout setFrame:CGRectMake(0, 0, size.width, 1) view:top];
    x += [layout setFrame:CGRectMake(x, 0, size.width, size.height) view:yself.RPCStatusLabel options:YOLayoutOptionsSizeToFitHorizontal].size.width + 10;
    x += [layout setFrame:CGRectMake(x, 0, 1, size.height) view:border].size.width + 10;
    x += [layout setFrame:CGRectMake(x, 0, size.width, size.height) view:yself.serverStatusLabel options:YOLayoutOptionsSizeToFitHorizontal].size.width + 10;
    x += [layout setFrame:CGRectMake(x, 0, 1, size.height) view:right].size.width + 10;
    return CGSizeMake(x, size.height);
  }];
  [self setRPCConnected:NO serverConnected:NO];
}

- (void)setRPCConnected:(BOOL)RPCConnected serverConnected:(BOOL)serverConnected {
  if (RPCConnected) {
    [_RPCStatusLabel setMarkup:NSStringWithFormat(@"keybased: <ok>%@</ok>", self.config.socketFile) style:KBLabelStyleDefault alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  } else {
    [_RPCStatusLabel setMarkup:NSStringWithFormat(@"keybased: <error>%@</error>", self.config.socketFile ? self.config.socketFile : @"?") style:KBLabelStyleDefault alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  }
  NSString *host = @"?";
  if (_config.serverURI) {
    NSURL *URL = [NSURL URLWithString:_config.serverURI];
    host = NSStringWithFormat(@"%@:%@", URL.host, URL.port);
  }

  [_serverStatusLabel setMarkup:NSStringWithFormat(@"API: %@", host) style:KBLabelStyleDefault alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];

}


@end
