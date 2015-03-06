//
//  KBTrackEntryView.h
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBAppKit.h"
#import "KBRPC.h"

@interface KBTrackEntryView : KBImageTextView

- (void)setTrackEntry:(KBRTrackEntry *)trackEntry;

@end

