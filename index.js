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

// Error handler
adapter.onTurnError = async (context, error) => {
    console.error(`\n [onTurnError] unhandled error: ${error}`);
    await context.sendActivity(`Oops. Something went wrong!`);
};

// Create HTTP server
const app = express();
app.use(express.json());

// Listen for incoming requests
app.post('/api/messages', (req, res) => {
    adapter.processActivity(req, res, async (context) => {
        await bot.run(context);
    });
});

// Webhook endpoint
app.post('/api/webhook', async (req, res) => {
    try {
        console.log('=== WEBHOOK REQUEST RECEIVED ===');
        console.log('Request Body:', JSON.stringify(req.body));

        const conversationReferences = await bot.getAllConversationReferences();
        
        if (!conversationReferences || conversationReferences.length === 0) {
            throw new Error('No conversation references found');
        }

        // Process placeholders in the card
        const processedCard = JSON.parse(JSON.stringify(req.body));
        const placeholders = {
            '%%User%%': req.body.user || 'Not specified',
            '%%EventType%%': req.body.eventType || 'Not specified',
            '%%RequestId%%': req.body.requestId || 'Not specified',
            '%%Timestamp%%': req.body.timestamp || new Date().toISOString(),
            '%%HostName%%': req.body.hostname || 'Not specified',
            '%%TicketNumber%%': req.body.ticketNumber || 'Not specified',
            '%%FilePathObjectId%%': req.body.filePathObjectId || 'Not specified',
            '%%Reason%%': req.body.reason || 'Not specified',
            '%%ApplicationGroup%%': req.body.applicationGroup || 'Not specified',
            '%%NumericTicket%%': (req.body.ticketNumber || '').replace(/^[A-Za-z]+0*/, '')
        };

        // Replace placeholders in the card JSON
        const cardJson = JSON.stringify(processedCard);
        const processedCardJson = Object.entries(placeholders).reduce(
            (acc, [key, value]) => acc.replace(new RegExp(key, 'g'), value),
            cardJson
        );
        const finalCard = JSON.parse(processedCardJson);

        // Send message to all stored conversations
        for (const reference of conversationReferences) {
            try {
                await adapter.continueConversation(reference, async (context) => {
                    await context.sendActivity({ attachments: finalCard.attachments });
                });
            } catch (err) {
                console.error(`Error sending to conversation ${reference.conversation.id}:`, err);
            }
        }

        res.status(200).send('Notifications sent successfully');
    } catch (error) {
        console.error('Error in webhook handler:', error);
        res.status(500).send(error.message);
    }
});

const port = process.env.PORT || 3978;
app.listen(port, () => {
    console.log(`\n${bot.constructor.name} listening at http://localhost:${port}`);
});
