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

@interface KBScrollView : YOView

@property NSScrollView *scrollView;

- (void)setDocumentView:(NSView *)documentView;

@end
