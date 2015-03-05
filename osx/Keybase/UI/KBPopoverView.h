//
//  KBPopoverView.h
//  Keybase
//
//  Created by Gabriel on 3/4/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBView.h"

@interface KBPopoverView : KBView

- (void)setText:(NSString *)text title:(NSString *)title;

- (void)show:(id)sender;
- (void)hide:(id)sender;

- (void)sizeToFitWithWidth:(CGFloat)width;

@end
