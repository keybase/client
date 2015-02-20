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

@interface KBScrollView : YONSView

@property NSScrollView *scrollView;

- (void)setDocumentView:(NSView *)documentView;

@end
