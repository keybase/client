//
//  KBPopover.m
//  Keybase
//
//  Created by Gabriel on 4/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPopover.h"

#import "KBWindow.h"

@interface KBPopoverWindow : NSWindow

@end

@interface KBPopover ()
@property NSView *sender;
@property KBPopoverWindow *window;
@end

@implementation KBPopover

- (void)show:(NSView *)sender {
  KBPopoverWindow *window = [[KBPopoverWindow alloc] init];
  window.styleMask = NSFullSizeContentViewWindowMask | NSTitledWindowMask;
  window.hasShadow = YES;
  window.titleVisibility = NSWindowTitleHidden;
  window.titlebarAppearsTransparent = YES;
  window.movableByWindowBackground = YES;
  window.delegate = self;
  _contentView.frame = CGRectMake(0, 0, _contentSize.width, _contentSize.height);
  [window setContentSize:_contentSize];
  [window setContentView:_contentView];
  [window setMovable:NO];

  self.window = window;

  CGRect rect = [sender convertRect:sender.bounds toView: nil];
  [window setFrameOrigin:CGPointMake(sender.window.frame.origin.x + rect.origin.x, sender.window.frame.origin.y + rect.origin.y - _contentSize.height)];

  [sender.window addChildWindow:window ordered:NSWindowAbove];
}

- (void)close {
  [_window.parentWindow removeChildWindow:_window];
  _window = nil;
}

- (BOOL)isShowing {
  return _window.isVisible;
}

@end


@implementation KBPopoverWindow

- (BOOL)canBecomeKeyWindow {
  return NO;
}

- (BOOL)canBecomeMainWindow {
  return NO;
}

@end
