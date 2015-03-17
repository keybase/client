//
//  KBView.h
//  Keybase
//
//  Created by Gabriel on 3/2/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <YOLayout/YOLayout.h>

@interface KBView : YOView

@property BOOL clipToBounds; // Writable alias for wantsDefaultClipping

@end

@interface NSView (KBView)
- (void)setBackgroundColor:(NSColor *)backgroundColor;
@end