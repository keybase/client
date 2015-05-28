//
//  KBPGPTextView.h
//  Keybase
//
//  Created by Gabriel on 5/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import "KBTextView.h"

@interface KBPGPTextView : KBTextView

@property (nonatomic) NSString *armoredText;
@property (nonatomic) NSData *data;
@property (nonatomic, getter=isEditable) BOOL editable;

@end
