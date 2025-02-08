const fetch = require('node-fetch');

async function getBeyondTrustToken(context) {
  try {
    // Construct the token URL using the environment variable
    const tokenUrl = `${process.env.BEYONDTRUST_BASE_URL}/oauth/connect/token`;

    // Log environment values for troubleshooting
    context.log(`BEYONDTRUST_BASE_URL: ${process.env.BEYONDTRUST_BASE_URL}`);
    context.log(`BEYONDTRUST_CLIENT_ID: ${process.env.BEYONDTRUST_CLIENT_ID}`);
    context.log(`BEYONDTRUST_CLIENT_SECRET: ${process.env.BEYONDTRUST_CLIENT_SECRET}`);

    // Set up URL-encoded parameters
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.BEYONDTRUST_CLIENT_ID);
    params.append('client_secret', process.env.BEYONDTRUST_CLIENT_SECRET);

    // Log the constructed URL and request body
    context.log(`Constructed Token URL: ${tokenUrl}`);
    context.log(`Token Request Body: ${params.toString()}`);

    // Send the POST request to the token endpoint
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    context.log(`Token endpoint response status: ${response.status}`);
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Token request failed with status ${response.status}. Response: ${errorBody}`);
    }
    const data = await response.json();
    context.log(`Token response data: ${JSON.stringify(data)}`);
    return data.access_token;
  } catch (error) {
    throw new Error(`Failed to get BeyondTrust token: ${error.message}`);
  }
}

module.exports = async function (context, req) {
  try {
    context.log('handleapproval function processed a request.');

    // Extract query parameters from the request
    const decision = req.query.decision || 'Pending';
    const requestId = req.query.requestId;
    const user = req.query.user;
    const eventType = req.query.eventType;
    const timestamp = req.query.timestamp;

    if (!requestId) {
      context.res = {
        status: 400,
        body: "Missing required parameter: requestId"
      };
      return;
    }

    // Retrieve the OAuth token
    const accessToken = await getBeyondTrustToken(context);

    // Generate the current timestamp in the expected format
    const currentTime = new Date()
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d+Z$/, '');

    // Construct the payload for the API call
    const payload = {
      status: decision === 'Approved' ? '2000' : '2001',
      decision: decision,
      decisionPerformedByUser: user || 'mobileuser',
      duration: "Once",
      itsmRequestId: requestId,
      decisionTime: currentTime,
      message: decision === 'Approved' ? 'please proceed' : 'request denied',
      systemId: requestId,
      ticketId: `EPM${Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, '0')}`,
      ticketUrl: `https://demo2.pm.beyondtrustcloud.com/jit-access-management/details/${Math.floor(Math.random() * 1000)}`
    };

    // Log the full API call details being sent
    const approvalUrl = `${process.env.BEYONDTRUST_BASE_URL}/api/v2/AuthorizationRequest/notification`;
    context.log(`Full API Call Details:`);
    context.log(`POST ${approvalUrl}`);
    context.log(`Headers: { "Content-Type": "application/json", "Authorization": "Bearer ${accessToken}", "x-correlation-id": "${requestId}" }`);
    context.log(`Body: ${JSON.stringify(payload)}`);

    // Send the API call to BeyondTrust's Approval endpoint
    const apiResponse = await fetch(approvalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'x-correlation-id': requestId
      },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`API responded with status: ${apiResponse.status}, body: ${errorText}`);
    }

    context.res = {
      status: 200,
      body: {
        message: `Request ${decision.toLowerCase()} successfully`,
        details: payload
      }
    };
  } catch (error) {
    context.log.error('Error processing approval request:', error);
    context.res = {
      status: 500,
      body: {
        message: "Error processing approval request",
        error: error.message
      }
    };
  }
};
