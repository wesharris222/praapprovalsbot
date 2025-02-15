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

// Listen for incoming activities
app.post('/api/messages', (req, res) => {
    console.log('Received message activity:', JSON.stringify(req.body, null, 2));
    adapter.processActivity(req, res, async (context) => {
        await bot.run(context);
    });
});

// Enhanced webhook endpoint
app.post('/api/webhook', async (req, res) => {
    try {
        console.log('=== PRA WEBHOOK REQUEST RECEIVED ===');
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
        console.log('Request Headers:', JSON.stringify(req.headers, null, 2));

        const conversationReferences = await bot.getAllConversationReferences();
        if (!conversationReferences || conversationReferences.length === 0) {
            console.error('No conversation references found');
            throw new Error('No conversation references found');
        }

        console.log('Found conversation references:', conversationReferences.length);

        // Process placeholders in the card
        const processedCard = JSON.parse(JSON.stringify(req.body));
        const placeholders = {
            '%%RequestId%%': req.body.request_id || 'Not specified',
            '%%TicketId%%': req.body.ticket_id || 'Not specified',
            '%%Hostname%%': req.body.jump_item?.computer_name || 'Not specified',
            '%%JumpType%%': req.body.jump_item?.type || 'Not specified',
            '%%Username%%': req.body.user?.username || 'Not specified',
            '%%Email%%': req.body.user?.email_address || 'Not specified',
            '%%JumpGroup%%': req.body.jump_item?.group || 'Not specified',
            '%%ResponseUrl%%': req.body.response_url || 'Not specified'
        };

        console.log('Processing placeholders:', placeholders);

        // Create Teams card
        const finalCard = {
            attachments: [{
                contentType: "application/vnd.microsoft.card.adaptive",
                content: {
                    type: "AdaptiveCard",
                    version: "1.4",
                    body: [
                        {
                            type: "TextBlock",
                            size: "Medium",
                            weight: "Bolder",
                            text: "PRA Access Approval Request"
                        },
                        {
                            type: "FactSet",
                            facts: [
                                { title: "Request ID:", value: placeholders['%%RequestId%%'] },
                                { title: "Ticket ID:", value: placeholders['%%TicketId%%'] },
                                { title: "Hostname:", value: placeholders['%%Hostname%%'] },
                                { title: "Access Type:", value: placeholders['%%JumpType%%'] },
                                { title: "Requester:", value: placeholders['%%Username%%'] },
                                { title: "Email:", value: placeholders['%%Email%%'] },
                                { title: "Jump Group:", value: placeholders['%%JumpGroup%%'] }
                            ]
                        }
                    ],
                    actions: [
                        {
                            type: "Action.Execute",
                            title: "Approve",
                            verb: "approve",
                            data: {
                                decision: "allow",
                                requestId: placeholders['%%RequestId%%'],
                                responseUrl: placeholders['%%ResponseUrl%%']
                            },
                            style: "positive"
                        },
                        {
                            type: "Action.Execute",
                            title: "Deny",
                            verb: "deny",
                            data: {
                                decision: "deny",
                                requestId: placeholders['%%RequestId%%'],
                                responseUrl: placeholders['%%ResponseUrl%%']
                            },
                            style: "destructive"
                        }
                    ]
                }
            }]
        };

        console.log('Processed card:', JSON.stringify(finalCard, null, 2));

        // Send message to all stored conversations
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
        console.error('Detailed webhook error:', {
            message: error.message,
            stack: error.stack,
            body: req.body
        });
        res.status(500).send(error.message);
    }
});

const port = process.env.PORT || 3978;
app.listen(port, () => {
    console.log(`\n${bot.constructor.name} listening at http://localhost:${port}`);
});
