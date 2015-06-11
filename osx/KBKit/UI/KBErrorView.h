//
//  KBErrorView.h
//  Keybase
//
//  Created by Gabriel on 3/6/15.
//  Copyright (c) 2015 Gabriel Handford. All rights reserved.
//

#import <Foundation/Foundation.h>

#import <KBAppKit/KBAppKit.h>

@interface KBErrorView : YOView

@property (readonly) KBButton *closeButton;

- (void)setError:(NSError *)error;

@end
