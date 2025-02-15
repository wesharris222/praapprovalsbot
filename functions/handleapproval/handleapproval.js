module.exports = async function (context, req) {
    try {
        context.log('PRA approval handler started');
        context.log('Request query:', JSON.stringify(req.query));

        const decision = req.query.decision;
        const requestId = req.query.requestId;
        const responseUrl = req.query.responseUrl;
        const message = req.query.message || '';

        if (!requestId || !responseUrl || !decision) {
            throw new Error('Missing required parameters');
        }

        // Prepare response for PRA
        const payload = {
            response_id: requestId,
            response: decision,
            message: message
        };

        context.log('Sending response to PRA:', JSON.stringify(payload));

        const response = await fetch(responseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`PRA API responded with status: ${response.status}`);
        }

        context.res = {
            status: 200,
            body: {
                message: `Request ${decision} successfully processed`
            }
        };
    } catch (error) {
        context.log.error('Error in PRA approval handler:', error);
        context.res = {
            status: 500,
            body: {
                error: error.message
            }
        };
    }
};
