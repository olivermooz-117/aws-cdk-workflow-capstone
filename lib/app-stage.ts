import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { WorkflowStack } from './workflow-stack';

export class AppStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);
    new WorkflowStack(this, 'WorkflowStack');
  }
}
