//
//  KBDebugView.m
//  Keybase
//
//  Created by Gabriel on 3/5/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBDebugView.h"

#import "KBMockViews.h"
#import "KBDebugStatusView.h"
#import "KBTestClientView.h"

@interface KBDebugView ()
@property KBMockViews *catalogView;
@property KBDebugStatusView *debugStatusView;
@end

@implementation KBDebugView

- (void)viewInit {
  [super viewInit];

  KBMockViews *mockViews = [[KBMockViews alloc] init];
  [self addSubview:mockViews];

  //[contentView addSubview:[KBButton linkWithText:@"Test RPC Client" actionBlock:^(id sender) { [self showTestClientView]; }]];

  YOSelf yself = self;
  self.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    [layout setFrame:CGRectMake(0, 0, size.width, size.height - 30) view:mockViews];
    [layout setFrame:CGRectMake(0, size.height - 30, size.width, 30) view:yself.debugStatusView];
    return size;
  }];
}

- (NSWindow *)openInWindow:(YONSView *)view size:(CGSize)size title:(NSString *)title {
  KBNavigationView *navigation = [[KBNavigationView alloc] initWithView:view title:title];
  NSWindow *window = [KBWindow windowWithContentView:navigation size:size retain:YES];
  window.styleMask = window.styleMask | NSResizableWindowMask;
  [window center];
  [window setFrameOrigin:self.window.frame.origin];
  [window makeKeyAndOrderFront:nil];
  return window;
}

- (void)showTestClientView {
  KBTestClientView *testClientView = [[KBTestClientView alloc] init];
  [self openInWindow:testClientView size:CGSizeMake(360, 420) title:@"Test Client"];
}

@end
