//
//  KBFileSelectView.h
//  Keybase
//
//  Created by Gabriel on 3/26/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <Tikppa/Tikppa.h>

@interface KBFileSelectView : YOView

- (void)setLabelText:(NSString *)labelText;

- (NSString *)path;

@end
