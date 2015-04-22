//
//  KBRuntimeStatusView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBRuntimeStatusView.h"
#import "AppDelegate.h"

@implementation KBRuntimeStatusView

- (void)update {
  NSString *socketPath = _client.environment.sockFile;

  NSMutableString *status = [NSMutableString string];
  [status appendString:@"keybased: "];
  [status appendString:_RPCConnected ? NSStringWithFormat(@"<ok>%@</ok>", socketPath) : NSStringWithFormat(@"%@ (disconnected)", socketPath)];
  //[status appendFormat:@" (%@)", _config.version];
  [status appendString:@"\n"];

  [status appendString:@"API: "];
  if (_config.serverURI) {
    NSURL *URL = [NSURL URLWithString:_config.serverURI];
    NSString *host = NSStringWithFormat(@"%@://%@", URL.scheme, URL.host);
    if (URL.port) {
      host = NSStringWithFormat(@"%@:%@", host, URL.port);
    }
    [status appendString:host];
  }

  [self setMarkup:status options:@{@"lineSpacing": @(10)}];

  [self setNeedsLayout];
}

@end
