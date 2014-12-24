//
//  GRViewController.m
//  Navigation
//
//  Created by Guilherme Rambo on 19/05/14.
//  Copyright (c) 2014 Guilherme Rambo. All rights reserved.
//

#import "GRViewController.h"

@implementation GRViewController

- (void)awakeFromNib
{
  [super awakeFromNib];
  
  [self viewDidLoad];
}

- (void)viewDidLoad
{
  // default implementation does nothing
}

- (void)viewWillAppear:(BOOL)animated
{
  // default implementation does nothing
}

- (void)viewDidAppear:(BOOL)animated
{
  // default implementation does nothing
}

- (void)viewWillDisappear:(BOOL)animated
{
  // default implementation does nothing
}

- (void)viewDidDisappear:(BOOL)animated
{
  // default implementation does nothing
}

@end

@implementation GRViewController (Private)

- (void)setNavigationController:(GRNavigationController *)controller
{
  _navigationController = controller;
}

@end