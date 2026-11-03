// AWS SDK v3 is included in the Node.js 18+ Lambda runtime (v2 is not).
const { SSMClient, GetParameterCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({});

exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));

  // Lets you demonstrate Step Functions retries/catch on demand.
  if (event && event.simulateError === true) {
    throw new Error('Simulated failure to demonstrate Step Functions retry');
  }

  const result = await ssm.send(new GetParameterCommand({
    Name: process.env.PARAM_NAME || '/app/config/greeting',
    WithDecryption: false,
  }));
  const greeting = result.Parameter.Value;

  console.log('Retrieved from SSM:', greeting);

  return { status: 'Success', greeting };
};
