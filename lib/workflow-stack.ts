import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';

export class WorkflowStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Configuration: SSM Parameter Store
    const configParam = new ssm.StringParameter(this, 'AppGreeting', {
      parameterName: '/app/config/greeting',
      stringValue: 'Hello from CI/CD Automated Infrastructure!',
      description: 'Greeting read at runtime by the workflow Lambda',
    });

    // 2. Compute: Lambda that reads the parameter at runtime
    const taskFn = new lambda.Function(this, 'WorkflowTask', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      timeout: cdk.Duration.seconds(10),
      environment: { PARAM_NAME: configParam.parameterName },
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Least privilege: ssm:GetParameter on this one parameter only
    configParam.grantRead(taskFn);

    // 3. Orchestration: Pass -> Task (retry + catch) -> Succeed
    const prepare = new sfn.Pass(this, 'Prepare Input', {
      // Keeps the original input and adds a timestamp under $.meta
      parameters: { 'requestedAt.$': '$$.State.EnteredTime' },
      resultPath: '$.meta',
    });

    const invoke = new tasks.LambdaInvoke(this, 'Invoke Task', {
      lambdaFunction: taskFn,
      payloadResponseOnly: true,
    });

    invoke.addRetry({
      errors: ['States.TaskFailed', 'Lambda.ServiceException', 'Lambda.TooManyRequestsException'],
      interval: cdk.Duration.seconds(2),
      maxAttempts: 2,
      backoffRate: 2,
    });

    const handledFailure = new sfn.Fail(this, 'Workflow Failed', {
      cause: 'Lambda failed after retries',
      error: 'TaskFailedAfterRetries',
    });
    invoke.addCatch(handledFailure, { errors: ['States.ALL'], resultPath: '$.error' });

    const definition = prepare.next(invoke).next(new sfn.Succeed(this, 'Workflow Succeeded'));

    const logGroup = new logs.LogGroup(this, 'StateMachineLogs', {
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const stateMachine = new sfn.StateMachine(this, 'WorkflowStateMachine', {
      stateMachineName: 'capstone-workflow',
      definitionBody: sfn.DefinitionBody.fromChainable(definition),
      timeout: cdk.Duration.minutes(2),
      logs: { destination: logGroup, level: sfn.LogLevel.ALL },
      tracingEnabled: true,
    });

    new cdk.CfnOutput(this, 'StateMachineArn', { value: stateMachine.stateMachineArn });
    new cdk.CfnOutput(this, 'LambdaName', { value: taskFn.functionName });
  }
}
