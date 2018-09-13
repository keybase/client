//
//  InitFailedViewController.h
//  KeybaseShare
//
//  Created by Michael Maxim on 9/10/18.
//  Copyright © 2018 Keybase. All rights reserved.
//

#import <UIKit/UIKit.h>

@protocol InitFailedViewDelegate<NSObject>
-(void)initFailedClosed;
@end

@interface InitFailedViewController : UIViewController
@property (weak) UIViewController<InitFailedViewDelegate> *delegate;
@end
