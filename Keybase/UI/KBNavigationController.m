//
//  KBNavigationController.h
//  Keybase
//
//  Created by Gabriel on 12/22/14.
//  Copyright (c) 2014 Gabriel Handford. All rights reserved.
//

#import "KBNavigationController.h"

typedef NS_ENUM (NSInteger, KBNavigationDirection) {
  KBNavigationDirectionBack = -1,
  KBNavigationDirectionForward = 1
};

@interface NSView (KBNavigationView)
- (void)setNavigationController:(KBNavigationController *)controller;
//- (void)viewWillAppear:(BOOL)animated;
//- (void)viewDidAppear:(BOOL)animated;
//- (void)viewWillDisappear:(BOOL)animated;
//- (void)viewDidDisappear:(BOOL)animated;
@end

@interface KBNavigationView : YONSView
@property (nonatomic) NSMutableArray *views;
@end

@interface KBNavigationController ()
@property KBNavigationView *navigationView;
@end

@implementation KBNavigationView

- (void)viewInit {
  [super viewInit];
  _views = [NSMutableArray array];
}

@end

@implementation KBNavigationController

- (void)loadView {
  //  NSVisualEffectView *effectView = [[NSVisualEffectView alloc] init];
  //  effectView.blendingMode = NSVisualEffectBlendingModeBehindWindow;
  //  effectView.state = NSVisualEffectStateActive;

  _navigationView = [[KBNavigationView alloc] initWithFrame:CGRectMake(0, 0, 350, 600)];
  YOSelf yself = self;
  _navigationView.viewLayout = [YOLayout layoutWithLayoutBlock:^(id<YOLayout> layout, CGSize size) {
    CGFloat y = 0;
    if (yself.titleView) {
      y += [layout setFrame:CGRectMake(0, 0, size.width, yself.titleView.frame.size.height) view:yself.titleView].size.height;
    }

    for (NSView *view in yself.navigationView.views) {
      [layout setFrame:CGRectMake(0, y, size.width, size.height - y) view:view];
    }
    return size;
  }];
  self.view = _navigationView;
}

- (void)pushView:(NSView *)view animated:(BOOL)animated {
  if (animated) {
    if ([self.transition.type isEqualToString:kCATransitionPush]) self.transition.subtype = kCATransitionFromRight;
    self.view.animations = @{@"subviews": self.transition};
  }
  
  [self _pushView:view animated:animated];
}

- (void)pushView:(NSView *)view transition:(CATransition *)transition transactionBlock:(void (^)())transactionBlock {
  if (transition) {
    self.view.animations = @{@"subviews": transition};
  } else {
    self.view.animations = @{@"subviews": self.transition};
  }
  
  if (transactionBlock) {
    [CATransaction begin];
    if (transactionBlock) transactionBlock();
    [self _pushView:view animated:YES];
    [CATransaction commit];
  } else {
    [self _pushView:view animated:YES];
  }
}

- (void)popViewAnimated:(BOOL)animated {
  if (!_navigationView.views || _navigationView.views.count == 1) {
    [NSException raise:NSGenericException format:@"KBNavigationController must have at least 1 child view"];
    return;
  }
  
  if (animated) {
    if ([self.transition.type isEqualToString:kCATransitionPush]) self.transition.subtype = kCATransitionFromLeft;
    self.view.animations = @{@"subviews": self.transition};
  } else {
    self.view.animations = @{@"subviews": [NSNull null]};
  }
  
  NSView *previousView = [self previousView];
  NSView *currentView = [self currentView];
  
  [self replaceView:currentView withView:previousView animated:animated direction:KBNavigationDirectionBack];
  
  [self removeView:[self currentView]];
}

- (CATransition *)transition {
  // Create a default transition if not set
  if (!_transition) {
    _transition = [CATransition animation];
    _transition.type = kCATransitionPush;
    _transition.subtype = kCATransitionFromRight;
    [_transition setValue:(id)kCFBooleanFalse forKey:kCATransitionFade];
  }
  
  return _transition;
}

- (void)setRootView:(NSView *)rootView {
  [self view];
  [_rootView removeFromSuperview];
  if (_rootView) [self removeView:_rootView];
  _rootView = rootView;
  [_navigationView addSubview:_rootView];
  [self addView:_rootView];

  [_navigationView setNeedsLayout];

  //[self.rootView viewWillAppear:NO];
  //[self.rootView viewDidAppear:NO];
}

- (void)setTitleView:(NSView *)titleView {
  [self view];
  [_titleView removeFromSuperview];
  _titleView = titleView;
  [_navigationView addSubview:_titleView];
  [_navigationView setNeedsLayout];
}

- (void)addView:(NSView *)view {
  [self view];
  [_navigationView.views addObject:view];
  [view setNavigationController:self];
}

- (void)removeView:(NSView *)view {
  [self view];
  [_navigationView.views removeObject:view];
  [view setNavigationController:nil];
}

- (NSView *)currentView {
  if (_navigationView.views.count == 0) return nil;
  return _navigationView.views[_navigationView.views.count-1];
}

- (NSView *)previousView {
  if ([self currentView] == self.rootView) return nil;
  return _navigationView.views[_navigationView.views.count-2];
}

- (void)_pushView:(NSView *)view animated:(BOOL)animated {
  NSView *currentView = [self currentView];

  if (!currentView) {
    self.rootView = view;
    return;
  }

  [self replaceView:currentView withView:view animated:animated direction:KBNavigationDirectionForward];
  [self addView:view];
}

- (void)replaceView:(NSView *)outView withView:(NSView *)inView animated:(BOOL)animated direction:(KBNavigationDirection)direction {
  inView.frame = outView.frame;

  if (animated) {
    [CATransaction begin]; {
      //[CATransaction setAnimationDuration:5.0];
      /*
      [outView viewWillDisappear:animated];
      [inView viewWillAppear:animated];
      
      [CATransaction setCompletionBlock:^{
        [inView viewDidAppear:animated];
        [outView viewDidDisappear:animated];
      }];
       */

      [self.view.animator replaceSubview:outView with:inView];
    }
    [CATransaction commit];
  } else {
    //[outView viewWillDisappear:animated];
    //[inView viewWillAppear:animated];

    [self.view replaceSubview:outView with:inView];
    
    //[inView viewDidAppear:animated];
    //[outView viewDidDisappear:animated];
  }
}

@end