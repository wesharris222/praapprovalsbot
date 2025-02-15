const { TeamsActivityHandler, MessageFactory } = require('botbuilder');
const { TableClient } = require('@azure/data-tables');
const fetch = require('node-fetch');

class ApprovalBot extends TeamsActivityHandler {
    constructor() {
        super();
        
        // Initialize Table Storage client
        this.tableClient = null;
        this.initializeStorage().then(() => {
            console.log('Storage initialized successfully');
        }).catch(err => {
            console.error('Error initializing storage:', err);
        });
    }

    async initializeStorage() {
        try {
            this.tableClient = TableClient.fromConnectionString(
                process.env.AzureStorageConnectionString,
                'conversationreferences'
            );
            await this.tableClient.createTable();
            console.log('Storage table created or exists');
        } catch (err) {
            console.error('Error creating table:', err);
            throw err;
        }
    }

    async onInstallationUpdate(context) {
        console.log('Installation update activity:', context.activity);
        if (context.activity.action === 'add') {
            await this.addConversationReference(context.activity);
            await context.sendActivity("Hi! I'm the approvals bot. I'll notify you of any approval requests.");
        }
    }

    async onConversationUpdateActivity(context) {
        await this.addConversationReference(context.activity);
        
        if (context.activity.membersAdded && context.activity.membersAdded.length > 0) {
            for (let idx in context.activity.membersAdded) {
                if (context.activity.membersAdded[idx].id === context.activity.recipient.id) {
                    if (context.activity.conversation.conversationType === 'channel') {
                        await context.sendActivity("Hi! I'm the approvals bot. I'll notify this channel of any approval requests.");
                    } else {
                        await context.sendActivity("Hi! I'm the approvals bot. I'll notify you of any approval requests.");
                    }
                }
            }
        }
        
        await super.onConversationUpdateActivity(context);
    }

    async onInvokeActivity(context) {
        console.log('Invoke Activity Full Context:', JSON.stringify(context, null, 2));

        if (context.activity.name === 'adaptiveCard/action') {
            const actionData = context.activity.value.action.data;
            console.log('Action Data:', JSON.stringify(actionData, null, 2));
            
            try {
                const functionUrl = process.env.FUNCTIONAPP_URL;
                const functionKey = process.env.FUNCTIONAPP_KEY;

                // Log all input values received
                console.log('Input Values:', context.activity.value);
                console.log('User Context:', context.activity.from);

                // Get message from input, default to "Not specified" if empty
                const message = actionData.approval_message || "Not specified";
                
                // Determine duration based on selection
                let duration = "Once";
                if (actionData.duration_type === "seconds" && actionData.duration_seconds) {
                    duration = actionData.duration_seconds.toString();
                }

                // Extract username from context
                const username = context.activity.from.name || 'Unknown User';
                console.log('Username captured:', username);

                const functionParams = new URLSearchParams({
                    decision: actionData.decision,
                    requestId: actionData.requestId,
                    ticketId: actionData.ticketNumber,
                    message: message,
                    duration: duration,
                    username: username
                }).toString();

                console.log('Function Parameters:', functionParams);
                console.log('Function URL:', `${functionUrl}?${functionParams}`);

                const response = await fetch(`${functionUrl}?${functionParams}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-functions-key': functionKey
                    }
                });

                const responseBody = await response.json();
                console.log('Function Response:', JSON.stringify(responseBody, null, 2));

                if (response.ok) {
                    return {
                        status: 200,
                        body: {
                            statusCode: 200,
                            type: 'application/vnd.microsoft.activity.message',
                            value: `Request ${actionData.decision} successfully processed by ${username}.`
                        }
                    };
                } else {
                    console.error('Function call failed. Status:', response.status);
                    console.error('Response body:', JSON.stringify(responseBody, null, 2));
                    return {
                        status: 500,
                        body: {
                            statusCode: 500,
                            type: 'application/vnd.microsoft.activity.message',
                            value: `Error processing request: ${JSON.stringify(responseBody)}`
                        }
                    };
                }
            } catch (error) {
                console.error('Detailed error:', {
                    message: error.message,
                    stack: error.stack,
                    context: JSON.stringify(context.activity, null, 2)
                });
                return {
                    status: 500,
                    body: {
                        statusCode: 500,
                        type: 'application/vnd.microsoft.activity.message',
                        value: `Error: ${error.message}`
                    }
                };
            }
        } else {
            console.log('Unknown invoke activity type:', context.activity.name);
        }
        return null;
    }

    async addConversationReference(activity) {
        if (!activity?.conversation?.id) {
            console.log('Invalid activity format:', activity);
            return;
        }

        try {
            if (!this.tableClient) {
                await this.initializeStorage();
            }

            const entity = {
                partitionKey: 'channel',
                rowKey: activity.conversation.id,
                reference: JSON.stringify({
                    channelId: activity.channelId,
                    serviceUrl: activity.serviceUrl,
                    conversation: {
                        id: activity.conversation.id,
                        name: activity.conversation.name,
                        conversationType: activity.conversation.conversationType,
                        isGroup: activity.conversation.isGroup,
                        tenantId: activity.conversation.tenantId
                    },
                    bot: activity.recipient,
                    tenantId: activity.conversation.tenantId
                })
            };

            await this.tableClient.upsertEntity(entity);
            console.log('Stored conversation reference');
        } catch (err) {
            console.error('Error storing conversation reference:', err);
        }
    }

    async getAllConversationReferences() {
        try {
            if (!this.tableClient) {
                await this.initializeStorage();
            }

            const references = [];
            const entities = this.tableClient.listEntities({
                queryOptions: { filter: "PartitionKey eq 'channel'" }
            });

            for await (const entity of entities) {
                if (entity.reference) {
                    try {
                        const reference = JSON.parse(entity.reference);
                        references.push(reference);
                    } catch (err) {
                        console.error('Error parsing reference:', err);
                    }
                }
            }

            return references;
        } catch (err) {
            console.error('Error retrieving conversation references:', err);
            return [];
        }
    }
}

module.exports = ApprovalBot;