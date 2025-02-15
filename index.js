const path = require('path');
const express = require('express');
const { BotFrameworkAdapter } = require('botbuilder');
const ApprovalBot = require('./bot');

// Create adapter
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Create bot instance
const bot = new ApprovalBot();

// Enhanced error handler
adapter.onTurnError = async (context, error) => {
    console.error(`\n [onTurnError] unhandled error: ${error}`);
    console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        activity: context.activity,
        error: error
    });
    await context.sendActivity('Oops. Something went wrong!');
};

// Create HTTP server
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Listen for incoming activities
app.post('/api/messages', (req, res) => {
    console.log('Received message activity:', JSON.stringify(req.body, null, 2));
    adapter.processActivity(req, res, async (context) => {
        await bot.run(context);
    });
});

// Enhanced webhook endpoint for PRA
app.post('/api/webhook', async (req, res) => {
    try {
        console.log('=== PRA WEBHOOK REQUEST RECEIVED ===');
        console.log('Raw Body:', req.body);
        console.log('Request Body Type:', typeof req.body);
        console.log('Request Headers:', JSON.stringify(req.headers, null, 2));

        // Log all available properties
        console.log('Available Properties:', Object.keys(req.body));

        const conversationReferences = await bot.getAllConversationReferences();
        if (!conversationReferences || conversationReferences.length === 0) {
            console.error('No conversation references found');
            throw new Error('No conversation references found');
        }

        console.log('Found conversation references:', conversationReferences.length);

        // Parse form data - handle both urlencoded and json
        let requestData = req.body;
        if (typeof requestData === 'string') {
            try {
                requestData = JSON.parse(requestData);
            } catch (e) {
                // If it's not JSON, try parsing URLEncoded
                const params = new URLSearchParams(requestData);
                requestData = {};
                for (const [key, value] of params) {
                    try {
                        requestData[key] = JSON.parse(value);
                    } catch {
                        requestData[key] = value;
                    }
                }
            }
        }

        // Log parsed data
        console.log('Parsed Request Data:', JSON.stringify(requestData, null, 2));

        // Try to parse nested objects that might be strings
        if (typeof requestData.jump_item === 'string') {
            try {
                requestData.jump_item = JSON.parse(requestData.jump_item);
            } catch (e) {
                console.log('Could not parse jump_item as JSON:', e);
            }
        }
        if (typeof requestData.user === 'string') {
            try {
                requestData.user = JSON.parse(requestData.user);
            } catch (e) {
                console.log('Could not parse user as JSON:', e);
            }
        }

        // Create card data from PRA request with all fields
        const cardData = {
            requestId: requestData.request_id || 'Not provided',
            ticketId: requestData.ticket_id || 'Not provided',
            responseUrl: requestData.response_url || 'Not provided',
            // Jump Item details
            hostname: requestData.jump_item?.computer_name || requestData['jump_item.computer_name'] || 'Not provided',
            jumpItemType: requestData.jump_item?.type || requestData['jump_item.type'] || 'Not provided',
            jumpItemComments: requestData.jump_item?.comments || requestData['jump_item.comments'] || 'Not provided',
            jumpItemGroup: requestData.jump_item?.group || requestData['jump_item.group'] || 'Not provided',
            jumpItemTags: requestData.jump_item?.tag || requestData['jump_item.tag'] || 'Not provided',
            jumpPointName: requestData.jump_item?.jumpoint_name || requestData['jump_item.jumpoint_name'] || 'Not provided',
            publicIp: requestData.jump_item?.public_ip || requestData['jump_item.public_ip'] || 'Not provided',
            privateIp: requestData.jump_item?.private_ip || requestData['jump_item.private_ip'] || 'Not provided',
            // User details
            userId: requestData.user?.id || requestData['user.id'] || 'Not provided',
            username: requestData.user?.username || requestData['user.username'] || 'Not provided',
            userPublicName: requestData.user?.public_display_name || requestData['user.public_display_name'] || 'Not provided',
            userPrivateName: requestData.user?.private_display_name || requestData['user.private_display_name'] || 'Not provided',
            userEmail: requestData.user?.email_address || requestData['user.email_address'] || 'Not provided'
        };

        console.log('Card Data:', JSON.stringify(cardData, null, 2));

        // Create Teams card with all fields
        const card = {
            "type": "AdaptiveCard",
            "body": [
                {
                    "type": "TextBlock",
                    "size": "Medium",
                    "weight": "Bolder",
                    "text": "PRA Access Approval Request",
                    "wrap": true
                },
                {
                    "type": "TextBlock",
                    "size": "Default",
                    "text": "Jump Item Details",
                    "weight": "Bolder",
                    "wrap": true
                },
                {
                    "type": "FactSet",
                    "facts": [
                        { "title": "Request ID", "value": cardData.requestId },
                        { "title": "Ticket ID", "value": cardData.ticketId },
                        { "title": "Hostname", "value": cardData.hostname },
                        { "title": "Access Type", "value": cardData.jumpItemType },
                        { "title": "Jump Group", "value": cardData.jumpItemGroup },
                        { "title": "Comments", "value": cardData.jumpItemComments },
                        { "title": "Tags", "value": cardData.jumpItemTags },
                        { "title": "Jumpoint", "value": cardData.jumpPointName },
                        { "title": "Public IP", "value": cardData.publicIp },
                        { "title": "Private IP", "value": cardData.privateIp }
                    ]
                },
                {
                    "type": "TextBlock",
                    "size": "Default",
                    "text": "User Details",
                    "weight": "Bolder",
                    "wrap": true,
                    "spacing": "Medium"
                },
                {
                    "type": "FactSet",
                    "facts": [
                        { "title": "User ID", "value": cardData.userId },
                        { "title": "Username", "value": cardData.username },
                        { "title": "Public Name", "value": cardData.userPublicName },
                        { "title": "Private Name", "value": cardData.userPrivateName },
                        { "title": "Email", "value": cardData.userEmail }
                    ]
                }
            ],
            "actions": [
                {
                    "type": "Action.Execute",
                    "title": "Approve",
                    "verb": "approve",
                    "data": {
                        "decision": "allow",
                        "requestId": cardData.requestId,
                        "responseUrl": cardData.responseUrl
                    },
                    "style": "positive"
                },
                {
                    "type": "Action.Execute",
                    "title": "Deny",
                    "verb": "deny",
                    "data": {
                        "decision": "deny",
                        "requestId": cardData.requestId,
                        "responseUrl": cardData.responseUrl
                    },
                    "style": "destructive"
                }
            ],
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.4"
        };

        const finalCard = {
            attachments: [{
                contentType: "application/vnd.microsoft.card.adaptive",
                content: card
            }]
        };

        // Send to all conversations
        for (const reference of conversationReferences) {
            try {
                console.log('Sending to conversation:', reference.conversation.id);
                await adapter.continueConversation(reference, async (context) => {
                    await context.sendActivity(finalCard);
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

const port = process.env.PORT || 3978;
app.listen(port, () => {
    console.log(`\n${bot.constructor.name} listening at http://localhost:${port}`);
});
