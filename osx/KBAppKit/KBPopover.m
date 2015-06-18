//
//  KBPopover.m
//  Keybase
//
//  Created by Gabriel on 4/9/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import "KBPopover.h"

#import "KBWindow.h"
#import "KBBorder.h"

@interface KBPopover ()
@property NSView *parentView;
@property (getter=isShowing) BOOL showing;
@end

@implementation KBPopover

- (void)showAboveView:(NSView *)view options:(KBPopoverOptions)options {
  NSAssert(_contentView, @"No contentView");
  [view addSubview:_contentView positioned:NSWindowAbove relativeTo:view];
  _showing = YES;
}

- (void)hide {
  [_contentView removeFromSuperview];
  _showing = NO;
}

- (void)setContentRect:(CGRect)contentRect {
  _contentRect = contentRect;
  [self _updateContentRect];
}

- (void)setMaxContentSize:(CGSize)maxContentSize {
  _maxContentSize = maxContentSize;
  [self _updateContentRect];
}

- (void)_updateContentRect {
  CGRect rect = _contentRect;
  if (_maxContentSize.width > 0) rect.size.width = MIN(_maxContentSize.width, rect.size.width);
  if (_maxContentSize.height > 0) rect.size.height = MIN(_maxContentSize.height, rect.size.height);
  _contentView.frame = rect;
}

@end


@interface KBNSPopoverWindow : NSWindow
@end

@interface KBPopoverWindow ()
@property NSView *parentView;
@property CGPoint position;
@property (getter=isShowing) BOOL showing;
@property KBNSPopoverWindow *window;
@end

@implementation KBPopoverWindow

- (void)showInWindowAboveView:(NSView *)view position:(CGPoint)position options:(KBPopoverOptions)options {
  NSAssert(_contentView, @"No contentView");
  _position = position;
  KBNSPopoverWindow *window = [[KBNSPopoverWindow alloc] init];
  window.styleMask = NSBorderlessWindowMask|NSTitledWindowMask|NSFullSizeContentViewWindowMask;
  window.hasShadow = (options & KBPopoverOptionsShadow);
  window.titleVisibility = NSWindowTitleHidden;
  window.titlebarAppearsTransparent = YES;
  window.movableByWindowBackground = YES;
  window.delegate = self;
  [window setContentView:_contentView];
  [window setMovable:NO];

  _window = window;
  _parentView = view;

  [self setContentSize:_contentSize];
}

- (void)hide {
  [_window.parentWindow removeChildWindow:_window];
  _showing = NO;
}

- (void)setContentSize:(CGSize)contentSize {
  _contentSize = contentSize;
  _contentView.frame = CGRectMake(0, 0, _contentSize.width, _contentSize.height);

  [_window setContentSize:_contentSize];

  NSWindow *parentWindow = _window.parentWindow;
  CGRect parentFrame = parentWindow ? parentWindow.frame : CGRectZero;
  CGRect rect = [_parentView convertRect:_parentView.bounds toView:nil];
  [_window setFrameOrigin:CGPointMake(parentFrame.origin.x + rect.origin.x + _position.x, parentFrame.origin.y + rect.origin.y + _position.y - _contentSize.height)];

  if (!_showing) {
    [_parentView.window addChildWindow:_window ordered:NSWindowAbove];
    _showing = YES;
  }
}


@end


@implementation KBNSPopoverWindow

- (BOOL)canBecomeKeyWindow {
  return NO;
}

- (BOOL)canBecomeMainWindow {
  return NO;
}

@end
