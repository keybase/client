//
//  KBProgressIndicator.h
//  Keybase
//
//  Created by Gabriel on 1/19/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

@import Foundation;
@import AppKit;
@import QuartzCore;

#import <YOLayout/YOLayout.h>

@interface KBActivityIndicatorView : YOView

@property (nonatomic, getter=isAnimating) BOOL animating;
@property BOOL hidesWhenStopped;

@property (nonatomic) CGFloat lineWidth;

- (void)startAnimating;
- (void)stopAnimating;

@end
