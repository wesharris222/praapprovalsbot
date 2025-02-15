const fetch = require('node-fetch');

module.exports = async function (context, req) {
    try {
        context.log('handleapproval function started');
        context.log('Request query:', JSON.stringify(req.query));
        context.log('Request body:', JSON.stringify(req.body));

        const decisionInput = req.query.decision;
        const requestId = req.query.requestId;
        const responseUrl = req.query.responseUrl;
        const username = req.query.username || 'Unknown User';
        const message = req.query.message || '';
        
        context.log('Parsed inputs:', { decisionInput, requestId, responseUrl, username, message });

        if (!requestId || !responseUrl || !decisionInput) {
            context.log.error('Missing required parameters');
            context.res = {
                status: 400,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: {
                    error: `Missing required parameters: ${!requestId ? 'requestId' : !responseUrl ? 'responseUrl' : 'decision'}`
                }
            };
            return;
        }

        const payload = {
            response_id: requestId,
            response: decisionInput,
            message: message
        };

        context.log(`Full API Call Details:`);
        context.log(`POST ${responseUrl}`);
        context.log(`Headers: { "Content-Type": "application/json" }`);
        context.log(`Body: ${JSON.stringify(payload)}`);

        const apiResponse = await fetch(responseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
            body: {
                message: `Request ${decisionInput} successfully processed by ${username}`
            }
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
