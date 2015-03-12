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
  [self addSubview:_RPCStatusLabel];

  _serverStatusLabel = [[KBLabel alloc] init];
  [self addSubview:_serverStatusLabel];

  self.viewLayout = [YOLayout vertical:self.subviews margin:UIEdgeInsetsZero padding:8];
}

- (void)setRPCConnected:(BOOL)RPCConnected serverConnected:(BOOL)serverConnected {

  NSString *socketPath = _client.socketPath;

  if (RPCConnected) {
    [_RPCStatusLabel setMarkup:NSStringWithFormat(@"keybased: <ok>%@</ok>", socketPath) style:KBLabelStyleDefault alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  } else {
    [_RPCStatusLabel setMarkup:NSStringWithFormat(@"keybased: <error>%@</error>", socketPath ? socketPath : @"?") style:KBLabelStyleDefault alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];
  }
  NSString *host = @"?";
  if (_config.serverURI) {
    NSURL *URL = [NSURL URLWithString:_config.serverURI];
    host = NSStringWithFormat(@"%@://%@", URL.scheme, URL.host);
    if (URL.port) {
      host = NSStringWithFormat(@"%@:%@", host, URL.port);
    }
  }

  [_serverStatusLabel setMarkup:NSStringWithFormat(@"API: %@", host) style:KBLabelStyleDefault alignment:NSLeftTextAlignment lineBreakMode:NSLineBreakByTruncatingTail];

  [self setNeedsLayout];
}


@end
