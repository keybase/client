//
//  KBNavigationView.h
//  Keybase
//
//  Created by Gabriel on 1/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

typedef NS_ENUM (NSInteger, KBNavigationTransitionType) {
  KBNavigationTransitionTypeNone,
  KBNavigationTransitionTypePush,
  KBNavigationTransitionTypePop,
  KBNavigationTransitionTypeFade
};

@class KBNavigationView;

@protocol KBNavigationTitleView <NSObject>
@property (nonatomic, getter=isProgressEnabled) BOOL progressEnabled;
@property (nonatomic) NSString *title;
- (void)navigationView:(KBNavigationView *)navigationView willTransitionView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType;
@end

@interface KBNavigationView : YONSView

@property (nonatomic) NSView<KBNavigationTitleView> *titleView;
@property (readonly) NSMutableArray *views; // Fix mutable

- (instancetype)initWithView:(NSView *)view;

- (void)pushView:(NSView *)view animated:(BOOL)animated;

- (void)popViewAnimated:(BOOL)animated;

- (void)swapView:(NSView *)view animated:(BOOL)animated;

- (void)setView:(NSView *)view transitionType:(KBNavigationTransitionType)transitionType;

@end
