//
//  KBScrollView.h
//  Keybase
//
//  Created by Gabriel on 2/12/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

#import <YOLayout/YOLayout.h>
#import "KBBorder.h"

@interface KBScrollView : YOView

@property (readonly) NSScrollView *scrollView;
@property (readonly) KBBorder *border;

+ (instancetype)scrollViewWithDocumentView:(NSView *)documentView;

- (void)setDocumentView:(NSView *)documentView;

- (void)setBorderEnabled:(BOOL)borderEnabled;

@end
