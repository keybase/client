//
//  KBProgressView.m
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBProgressView.h"

#import "KBProgressOverlayView.h"
#import <YOLayout/YOLayout+PrefabLayouts.h>

@interface KBProgressView ()
@property KBProgressOverlayView *progressView;
@property (copy) dispatch_block_t close;
@property (weak) id sender;
@end

@implementation KBProgressView

- (void)viewInit {
  [super viewInit];
  [self kb_setBackgroundColor:KBAppearance.currentAppearance.backgroundColor];

  _progressView = [[KBProgressOverlayView alloc] init];
  _progressView.animating = YES;
  [self addSubview:_progressView];

  self.viewLayout = [YOLayout fill:_progressView];
}

- (void)doIt:(dispatch_block_t)close {
  //GHWeakSelf gself = self;
  self.work(^(NSError *error) {
    if (error) {
      /*
      gself.progressView.animating = NO;
      [self setError:error];
      gself.errorView.closeButton.targetBlock = ^{
        [self close:self];
        close();
      };
       */
      [self close:self close:close];
      [KBActivity setError:error sender:self.sender];
    } else {
      [self close:self close:close];
    }
  });
}

- (void)openAndDoIt:(KBWindow *)window {
  [self openInWindow:window];
  [self doIt:^{}];
}

- (void)setProgressTitle:(NSString *)progressTitle {
  _progressView.title = progressTitle;
}

- (void)openInWindow:(KBWindow *)window {
  self.sender = window;
  [window addModalWindowForView:self rect:CGRectMake(0, 0, 200, 200)];
  GHWeakSelf gself = self;
  self.close = ^{
    [[gself window] close];
  };
}

- (void)close:(id)sender close:(dispatch_block_t)close {
  self.close();
  if (close) dispatch_async(dispatch_get_main_queue(), close);
}

@end
