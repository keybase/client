//
//  KBSplitView.h
//  Keybase
//
//  Created by Gabriel on 2/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>
#import "KBBox.h"

@interface KBSplitView : YOView

@property UIEdgeInsets insets;
@property CGFloat dividerPosition;
@property float dividerRatio;

@property KBBox *divider;

@property UIEdgeInsets rightInsets;

@property (nonatomic) NSView *leftView;
@property (nonatomic) NSView *rightView;

@end
