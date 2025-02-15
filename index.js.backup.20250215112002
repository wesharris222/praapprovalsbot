// Previous code remains the same until the webhook endpoint
app.post('/api/webhook', async (req, res) => {
    try {
        console.log('=== PRA WEBHOOK REQUEST RECEIVED ===');
        console.log('Request Body:', JSON.stringify(req.body, null, 2));

        const conversationReferences = await bot.getAllConversationReferences();
        if (!conversationReferences || conversationReferences.length === 0) {
            console.error('No conversation references found');
            throw new Error('No conversation references found');
        }

        // Create card data from PRA request
        const cardData = {
            requestId: req.body.request_id,
            ticketId: req.body.ticket_id,
            hostname: req.body.jump_item?.computer_name || 'Not specified',
            jumpItemType: req.body.jump_item?.type || 'Not specified',
            username: req.body.user?.username || 'Not specified',
            userEmail: req.body.user?.email_address || 'Not specified',
            jumpItemGroup: req.body.jump_item?.group || 'Not specified',
            responseUrl: req.body.response_url
        };

        // Create Teams card
        const card = {
            "type": "AdaptiveCard",
            "body": [
                {
                    "type": "TextBlock",
                    "size": "Medium",
                    "weight": "Bolder",
                    "text": "PRA Access Approval Request"
                },
                {
                    "type": "FactSet",
                    "facts": [
                        { "title": "Request ID:", "value": cardData.requestId },
                        { "title": "Ticket ID:", "value": cardData.ticketId },
                        { "title": "Hostname:", "value": cardData.hostname },
                        { "title": "Access Type:", "value": cardData.jumpItemType },
                        { "title": "Requester:", "value": cardData.username },
                        { "title": "Email:", "value": cardData.userEmail },
                        { "title": "Jump Group:", "value": cardData.jumpItemGroup }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": "Approve",
                    "data": {
                        "decision": "allow",
                        "requestId": cardData.requestId,
                        "responseUrl": cardData.responseUrl
                    },
                    "style": "positive"
                },
                {
                    "type": "Action.Submit",
                    "title": "Deny",
                    "data": {
                        "decision": "deny",
                        "requestId": cardData.requestId,
                        "responseUrl": cardData.responseUrl
                    },
                    "style": "destructive"
                }
            ],
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2"
        };

        // Send to all conversations
        for (const reference of conversationReferences) {
            try {
                await adapter.continueConversation(reference, async (context) => {
                    await context.sendActivity({
                        attachments: [{
                            contentType: "application/vnd.microsoft.card.adaptive",
                            content: card
                        }]
                    });
                });
            } catch (err) {
                console.error(`Error sending to conversation ${reference.conversation.id}:`, err);
            }
        }

        res.status(200).send('Notifications sent successfully');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send(error.message);
    }
});
