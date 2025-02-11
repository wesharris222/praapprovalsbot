const fetch = require('node-fetch');

async function getBeyondTrustToken(context) {
    try {
        context.log('Starting getBeyondTrustToken');
        const tokenUrl = `${process.env.BEYONDTRUST_BASE_URL}/oauth/connect/token`;

        context.log(`BEYONDTRUST_BASE_URL: ${process.env.BEYONDTRUST_BASE_URL}`);
        context.log(`BEYONDTRUST_CLIENT_ID: ${process.env.BEYONDTRUST_CLIENT_ID}`);
        context.log(`BEYONDTRUST_CLIENT_SECRET: ${process.env.BEYONDTRUST_CLIENT_SECRET}`);

        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', process.env.BEYONDTRUST_CLIENT_ID);
        params.append('client_secret', process.env.BEYONDTRUST_CLIENT_SECRET);

        context.log(`Constructed Token URL: ${tokenUrl}`);
        context.log(`Token Request Body: ${params.toString()}`);

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
        context.log.error('Error in getBeyondTrustToken:', error);
        throw error;
    }
}

module.exports = async function (context, req) {
    try {
        context.log('handleapproval function started');
        context.log('Request query:', JSON.stringify(req.query));
        context.log('Request body:', JSON.stringify(req.body));

        const decisionInput = req.query.decision || 'Pending';
        const decision = decisionInput.toLowerCase() === 'approved' ? 'Approved' : 'Denied';
        const requestId = req.query.requestId;
        const ticketId = req.query.ticketId;
        const username = req.query.username || 'Unknown User';
        const message = req.query.message || 'Not specified';
        const duration = req.query.duration || 'Once';
        
        context.log('Parsed inputs:', { decision, requestId, ticketId, username, message, duration });

        if (!requestId || !ticketId) {
            context.log.error('Missing required parameters');
            context.res = {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: {
                    error: `Missing required parameters: ${!requestId ? 'requestId' : 'ticketId'}`
                }
            };
            return;
        }

        const accessToken = await getBeyondTrustToken(context);
        const currentTime = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');

        const numericTicket = ticketId.replace(/^[A-Za-z]+0*/, '');
        const ticketUrl = `${process.env.BEYONDTRUST_BASE_URL}/jit-access-management/details/${numericTicket}`;

        const payload = {
            status: decision === 'Approved' ? '2000' : '2001',
            decision: decision,
            decisionPerformedByUser: username,
            duration: duration,
            itsmRequestId: requestId,
            decisionTime: currentTime,
            message: message,
            systemId: requestId,
            ticketId: ticketId,
            ticketUrl: ticketUrl
        };

        const approvalUrl = `${process.env.BEYONDTRUST_BASE_URL}/management-api/v2/AuthorizationRequest/notification/`;
        
        context.log(`Full API Call Details:`);
        context.log(`POST ${approvalUrl}`);
        context.log(`Headers: { "Content-Type": "application/json", "Authorization": "Bearer ${accessToken}", "x-correlation-id": "${requestId}" }`);
        context.log(`Body: ${JSON.stringify(payload)}`);

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
            headers: {
                'Content-Type': 'application/json'
            },
            body: payload
        };
        
        context.log('Function completed successfully');
    } catch (error) {
        context.log.error('Error in handleapproval function:', error);
        context.log.error('Error stack:', error.stack);
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                error: error.message
            }
        };
    }
};
