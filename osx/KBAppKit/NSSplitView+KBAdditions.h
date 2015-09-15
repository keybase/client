//
//  NSSplitView+KBAdditions.h
//  KBAppKit
//
//  Created by Gabriel on 9/15/15.
//  Copyright (c) 2015 KBAppKit. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>

@interface NSSplitView (KBAdditions)

- (CGFloat)kb_positionOfDividerAtIndex:(NSInteger)dividerIndex;

@end
