//
//  KBWebView.m
//  Keybase
//
//  Created by Gabriel on 1/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBWebView.h"

@interface KBWebView ()
@property WKWebView *webView;
@end

@implementation KBWebView

- (void)viewInit {
  [super viewInit];
  _webView = [[WKWebView alloc] init];
  [self addSubview:_webView];
  self.viewLayout = [YOLayout fill:self];
}

- (void)openURLString:(NSString *)URLString {
  NSParameterAssert(URLString);
  NSMutableURLRequest *URLRequest = [[NSMutableURLRequest alloc] initWithURL:[NSURL URLWithString:URLString] cachePolicy:NSURLRequestReloadIgnoringCacheData timeoutInterval:5.0];
  [_webView loadRequest:URLRequest];
}

@end


