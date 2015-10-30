//
//  KBPGPTextView.h
//  Keybase
//
//  Created by Gabriel on 5/28/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>

@interface KBPGPTextView : KBTextView

@property (readonly) NSData *data;
@property (nonatomic, getter=isEditable) BOOL editable;
@property (readonly, getter=isArmored) BOOL armored;

- (void)setData:(NSData *)data armored:(BOOL)armored;

- (void)open:(id)sender;

@end
