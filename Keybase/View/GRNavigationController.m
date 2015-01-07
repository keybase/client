//
//  GRNavigationController.m
//  Navigation
//
//  Created by Guilherme Rambo on 19/05/14.
//  Copyright (c) 2014 Guilherme Rambo. All rights reserved.
//

#import "GRNavigationController.h"
#import "GRViewController.h"

typedef NS_ENUM(NSInteger, GRNavigationDirection) {
  GRNavigationDirectionBack = -1,
  GRNavigationDirectionForward = 1
};

// this is a private method the navigation controller uses to set itself on the view controller
@interface GRViewController (Private)
- (void)setNavigationController:(GRNavigationController *)controller;
@end

@implementation GRNavigationController
{
  // the stack of view controllers
  NSArray *_viewControllers;
}

#pragma mark Public API

- (void)pushViewController:(GRViewController *)viewController animated:(BOOL)animated
{
  if (animated) {
    if ([self.transition.type isEqualToString:kCATransitionPush]) self.transition.subtype = kCATransitionFromRight;
    self.view.animations = @{@"subviews": self.transition};
  }
  
  [self reallyPushViewController:viewController animated:animated];
  
  [self updateBackButtonTitle];
}

- (void)pushViewController:(GRViewController *)viewController usingTransition:(CATransition *)transition withTransactionBlock:(void (^)())transactionBlock
{
  if (transition) {
    self.view.animations = @{@"subviews": transition};
  } else {
    self.view.animations = @{@"subviews": self.transition};
  }
  
  if (transactionBlock) {
    [CATransaction begin];
    if (transactionBlock) transactionBlock();
    [self reallyPushViewController:viewController animated:YES];
    [CATransaction commit];
  } else {
    [self reallyPushViewController:viewController animated:YES];
  }
  
  [self updateBackButtonTitle];
}

- (void)popViewControllerAnimated:(BOOL)animated
{
  if (!self.viewControllers || self.viewControllers.count == 1) {
    @throw [NSException exceptionWithName:@"Cannot pop view controller" reason:@"GRNavigationController must have at least 1 child view controller" userInfo:@{}];
    return;
  }
  
  if (animated) {
    if ([self.transition.type isEqualToString:kCATransitionPush]) self.transition.subtype = kCATransitionFromLeft;
    self.view.animations = @{@"subviews": self.transition};
  } else {
    self.view.animations = @{@"subviews": [NSNull null]};
  }
  
  GRViewController *previousViewController = [self previousViewController];
  GRViewController *currentViewController = [self currentViewController];
  
  [self replaceViewController:currentViewController withViewController:previousViewController animated:animated direction:GRNavigationDirectionBack];
  
  [self updateWindowTitleWithViewController:previousViewController];
  
  [self removeViewController:[self currentViewController]];
  
  [self updateBackButtonTitle];
}

- (NSArray *)viewControllers
{
  if (!_viewControllers) _viewControllers = [[NSArray alloc] init];
  
  return _viewControllers;
}

- (CATransition *)transition
{
  // create a default transition if not set
  if (!_transition) {
    _transition = [CATransition animation];
    _transition.type = kCATransitionPush;
    _transition.subtype = kCATransitionFromRight;
  }
  
  return _transition;
}

- (void)setBackButton:(id)backButton
{
  _backButton = backButton;
  
  [self.backButton setTarget:self];
  [self.backButton setAction:@selector(backButtonAction:)];
  
  [self.backButton setAlphaValue:0];
  [self.backButton setHidden:YES];
}

- (void)backButtonAction:(id)sender
{
  if (self.viewControllers.count <= 1) return;
  
  [self popViewControllerAnimated:YES];
}

#pragma mark Private API

- (void)awakeFromNib
{
  [super awakeFromNib];
  
  // default setting
  self.view.autoresizingMask = NSViewWidthSizable|NSViewHeightSizable;
  self.resizeChildren = YES;
  
  if (self.rootViewController) [self setupRootViewController];
}

- (void)setupRootViewController
{
  [self.rootViewController viewWillAppear:NO];
  
  if (self.resizeChildren) {
    self.rootViewController.view.frame = self.view.frame;
    self.rootViewController.view.autoresizingMask = NSViewWidthSizable|NSViewHeightSizable;
  }
  
  [self.view addSubview:self.rootViewController.view];
  [self updateWindowTitleWithViewController:self.rootViewController];
  [self addViewController:self.rootViewController];
  
  [self.rootViewController viewDidAppear:NO];
}

- (void)addViewController:(GRViewController *)viewController
{
  NSMutableArray *mutableViewControllers = [self.viewControllers mutableCopy];
  [mutableViewControllers addObject:viewController];
  _viewControllers = [mutableViewControllers copy];
  
  [viewController setNavigationController:self];
}

- (void)removeViewController:(GRViewController *)viewController
{
  NSMutableArray *mutableViewControllers = [self.viewControllers mutableCopy];
  [mutableViewControllers removeObject:viewController];
  _viewControllers = [mutableViewControllers copy];
  
  [viewController setNavigationController:nil];
}

- (void)updateWindowTitleWithViewController:(GRViewController *)viewController
{
  if (viewController.title) self.view.window.title = viewController.title;
}

- (GRViewController *)currentViewController
{
  if (self.viewControllers.count == 0) return nil;
  return self.viewControllers[self.viewControllers.count-1];
}

- (GRViewController *)previousViewController
{
  if ([self currentViewController] == self.rootViewController) return nil;
  
  return self.viewControllers[self.viewControllers.count-2];
}

- (void)reallyPushViewController:(GRViewController *)viewController animated:(BOOL)animated
{
  GRViewController *currentVC = [self currentViewController];
  
//  if (!currentVC) {
//    self.rootViewController = viewController;
//    [self.view.window setContentSize:viewController.view.frame.size];
//    [self.view.window center];
//    [self setupRootViewController];
//    return;
//  }
  
  [self replaceViewController:currentVC withViewController:viewController animated:animated direction:GRNavigationDirectionForward];
  
  [self updateWindowTitleWithViewController:viewController];
  
  [self addViewController:viewController];
}

- (void)replaceViewController:(GRViewController *)outController withViewController:(GRViewController *)inController animated:(BOOL)animated direction:(GRNavigationDirection)direction
{
  if (self.resizeChildren) {
    inController.view.frame = self.view.frame;
    inController.view.autoresizingMask = NSViewWidthSizable|NSViewHeightSizable;
  }
  
  // use custom rewind animation when going back, if available
  if (direction == GRNavigationDirectionBack && outController.rewindTransition) self.view.animations = @{@"subviews": outController.rewindTransition};
  
  if (animated) {
    // animated transition
    
    [CATransaction begin];
    {
      [outController viewWillDisappear:animated];
      [inController viewWillAppear:animated];
      
      [CATransaction setCompletionBlock:^{
        if (inController == _rootViewController) [self.backButton setHidden:YES];
        
        [inController viewDidAppear:animated];
        [outController viewDidDisappear:animated];
      }];
      
      if (inController == _rootViewController) {
        [[self.backButton animator] setAlphaValue:0];
      } else {
        [self.backButton setHidden:NO];
        [[self.backButton animator] setAlphaValue:1];
      }
      
      [self.view.animator replaceSubview:outController.view with:inController.view];
    }
    [CATransaction commit];
  } else {
    // static transition
    
    [outController viewWillDisappear:animated];
    [inController viewWillAppear:animated];
    
    if (inController == _rootViewController) {
      [self.backButton setAlphaValue:0];
      [self.backButton setHidden:YES];
    } else {
      [self.backButton setHidden:NO];
      [self.backButton setAlphaValue:1];
    }
    
    [self.view replaceSubview:outController.view with:inController.view];
    
    [inController viewDidAppear:animated];
    [outController viewDidDisappear:animated];
  }
}

/**
 Tries to set the back button title to the view controller
 it's going to pop to, works with NSButton and NSSegmentedControll
 */
- (void)updateBackButtonTitle
{
  NSString *title = @"Back"; //[self previousViewController].title;
  //if (!title) return;
  
  if ([self.backButton respondsToSelector:@selector(setTitle:)]) {
    // this works with NSButton
    [self.backButton setTitle:title];
  } else if ([self.backButton respondsToSelector:@selector(setLabel:forSegment:)]) {
    // this works with NSSegmentedControll
    [self.backButton setWidth:[self widthForString:title inControl:self.backButton] forSegment:0];
    [self.backButton setLabel:title forSegment:0];
  }
}

#define kBackButtonMinWidth 20.0
#define kBackButtonPadding 20.0
#define kBackButtonMaxWidth 98.0
/**
 Used when the back button is a NSSegmentedControll
 */
- (CGFloat)widthForString:(NSString *)string inControl:(id)control
{
  NSFont *font = [control font];
  if (!font || !string) return kBackButtonMinWidth;
  
  NSDictionary *attrs = @{NSFontAttributeName : font};
  NSAttributedString *attributedTitle = [[NSAttributedString alloc] initWithString:string attributes:attrs];
  
  return MIN(attributedTitle.size.width+kBackButtonPadding, kBackButtonMaxWidth);
}

@end