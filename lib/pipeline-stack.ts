import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines';
import { AppStage } from './app-stage';

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repo = this.node.tryGetContext('githubRepo') as string;
    const branch = this.node.tryGetContext('githubBranch') as string;
    const connectionArn = this.node.tryGetContext('connectionArn') as string;

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'capstone-cdk-pipeline',
      synth: new ShellStep('Synth', {
        // Any push to main triggers the pipeline
        input: CodePipelineSource.connection(repo, branch, { connectionArn }),
        commands: ['npm ci', 'npm run build', 'npx cdk synth'],
      }),
    });

    pipeline.addStage(new AppStage(this, 'Prod', {
      env: { account: this.account, region: this.region },
    }));
  }
}
